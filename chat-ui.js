/* Telegram-like chat gestures and authorized, lazy image previews. */
const KPPChat = {
  swipeReply(node, reply) {
    let gesture = null, suppressClick = false;
    const reset = () => { gesture = null; node.style.transform = ''; node.dataset.swipe = ''; };
    node.addEventListener('pointerdown', e => {
      suppressClick = false;
      if (!['touch', 'pen'].includes(e.pointerType) || e.isPrimary === false) { reset(); return; }
      const control = e.target && e.target.closest && e.target.closest('button,a,input,textarea,select');
      if (control && !control.classList.contains('dash-inline-photo')) return;
      gesture = {id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,active:false};
    });
    node.addEventListener('pointermove', e => {
      if (!gesture || gesture.id !== e.pointerId) return;
      const dx = e.clientX - gesture.x, dy = Math.abs(e.clientY - gesture.y);
      if (dy > 24 || dx < -12) { reset(); return; }
      if (!gesture.active && dx > 14 && dx > dy * 1.6) {
        gesture.active = true;
        if (node.setPointerCapture) node.setPointerCapture(e.pointerId);
      }
      if (!gesture.active) return;
      gesture.dx = dx;
      node.style.transform = 'translateX(' + Math.min(72, Math.max(0, dx)) + 'px)';
      node.dataset.swipe = dx >= 64 ? 'ready' : 'moving';
    });
    node.addEventListener('pointerup', e => {
      if (!gesture || gesture.id !== e.pointerId) return;
      const chosen = gesture.active && gesture.dx >= 64 && Math.abs(e.clientY - gesture.y) <= 24;
      reset(); if (chosen) { suppressClick = true; reply(); }
    });
    node.addEventListener('pointercancel', reset);
    node.addEventListener('lostpointercapture', reset);
    node.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopPropagation();}},true);
  },
  Media: class {
    constructor({api, current, root}) {
      this.api = api; this.current = current; this.generation = 0;
      this.cache = new Map(); this.flights = new Map(); this.jobs = []; this.running = 0;
      this.observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { this.observer.unobserve(e.target); e.target.loadPhoto(); } });
      }, {root, rootMargin:'160px'}) : null;
    }
    reset() {
      this.generation++;
      if (this.observer) this.observer.disconnect();
      this.cache.forEach(r => URL.revokeObjectURL(r.url)); this.cache.clear(); this.flights.clear();
      this.jobs.splice(0).forEach(job => job.reject(new Error('Percakapan berubah.')));
    }
    drain() {
      while (this.running < 2 && this.jobs.length) {
        const job = this.jobs.shift(); this.running++;
        Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(() => {this.running--;this.drain();});
      }
    }
    get(key, message) {
      if (!this.current(key)) return Promise.reject(new Error('Percakapan berubah.'));
      const id = key + ':' + message.ref, generation = this.generation;
      if (this.cache.has(id)) {
        const item = this.cache.get(id); this.cache.delete(id); this.cache.set(id,item); return Promise.resolve(item);
      }
      if (this.flights.has(id)) return this.flights.get(id);
      const request = new Promise((resolve,reject) => {
        this.jobs.push({resolve,reject,run:async () => {
          if (generation !== this.generation || !this.current(key)) throw new Error('Percakapan berubah.');
          const r = await this.api('konsolLampiran',{kunci:key,ref:message.ref});
          if (generation !== this.generation || !this.current(key)) throw new Error('Percakapan berubah.');
          if (!r.ok) throw new Error(r.pesan || 'Lampiran belum dapat dimuat.');
          if (!r.base64 || r.base64.length > 6990508) throw new Error('File lebih dari 5 MB. Buka Telegram.');
          const mime = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(r.mime) ? r.mime : 'application/octet-stream';
          const bytes = Uint8Array.from(atob(r.base64), c => c.charCodeAt(0));
          const blob = new Blob([bytes],{type:mime}), item = {blob,mime,nama:r.nama,url:URL.createObjectURL(blob)};
          this.cache.set(id,item);
          let size = [...this.cache.values()].reduce((n,x)=>n+x.blob.size,0);
          while (this.cache.size > 8 || size > 24 * 1024 * 1024) {
            const old = this.cache.keys().next().value, value = this.cache.get(old);
            this.cache.delete(old); size -= value.blob.size; URL.revokeObjectURL(value.url);
          }
          return item;
        }}); this.drain();
      });
      this.flights.set(id,request);
      request.then(() => {if(this.flights.get(id)===request)this.flights.delete(id);},() => {if(this.flights.get(id)===request)this.flights.delete(id);});
      return request;
    }
    image(message,key,open) {
      const generation = this.generation;
      const img = h('img',{alt:message.namaFile || 'Foto dalam percakapan',decoding:'async',hidden:true});
      const status = h('span',{class:'dash-photo-state',text:'Memuat foto…'});
      let loaded = false, loading = false;
      const tile = h('button',{type:'button',class:'dash-inline-photo','aria-label':'Perbesar foto','aria-busy':'true'},img,status);
      const valid = () => generation === this.generation && this.current(key);
      const failure = text => {img.hidden=true;loaded=false;tile.setAttribute('aria-busy','false');status.hidden=false;status.textContent=text || 'Foto belum dimuat · Coba lagi';};
      img.addEventListener('error',()=>{if(valid()) {const item=this.cache.get(key+':'+message.ref);if(item)URL.revokeObjectURL(item.url);this.cache.delete(key+':'+message.ref);failure();}});
      tile.loadPhoto = async () => {
        if (loading || loaded || !valid()) return;
        loading=true;tile.setAttribute('aria-busy','true');status.textContent='Memuat foto…';
        try {
          const item = await this.get(key,message); if(!valid())return;
          if(!/^image\//.test(item.mime))throw new Error('Format ini perlu dibuka melalui Telegram.');
          img.src=item.url;img.hidden=false;status.hidden=true;loaded=true;tile.setAttribute('aria-busy','false');
        } catch(e) {if(valid())failure(e.message+' · Ketuk untuk mencoba lagi');}
        finally {loading=false;}
      };
      tile.addEventListener('click',()=>loaded ? open(message,key) : tile.loadPhoto());
      if(this.observer)this.observer.observe(tile);else Promise.resolve().then(()=>tile.loadPhoto());
      return tile;
    }
  }
};
