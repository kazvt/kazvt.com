/* GFUMES storefront. Cart and order data stays in the visitor's browser. */
(() => {
  'use strict';
  const REMOTE = 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/';
  const PRODUCTS = {
    original: {name:'ORIGINAL AIR™',subtitle:'The bare minimum collection',price:29.99,thumb:'prototype-kit/thumbs/crate-color.webp'},
    static: {name:'STATIC CITRUS™',subtitle:'The crackling collection',price:34.99,thumb:'prototype-kit/thumbs/crate.webp'},
    phantom: {name:'PHANTOM BERRY™',subtitle:'The paranormal collection',price:34.99,thumb:'car-kit/thumbs/box.webp'},
    mint: {name:'ZERO-G MINT™',subtitle:'The orbital collection',price:39.99,thumb:'food-kit/thumbs/pizza-box.webp'}
  };
  const $ = (id) => document.getElementById(id);
  const money = (n) => '$' + n.toFixed(2);
  const safe = (str) => String(str).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const thumb = (path) => window.GFUMES_USE_LOCAL_ASSETS ? './assets/thumbs/' + path.replace('/thumbs/', '/') : REMOTE + path;
  const load = (key, defaultValue) => {try {return JSON.parse(localStorage.getItem(key)) || defaultValue;}catch {return defaultValue;}};
  const save = (key, value) => {try {localStorage.setItem(key,JSON.stringify(value));}catch { /* private mode */ }};
  let cart = load('gfumes-cart-v1',{});
  let orders = load('gfumes-orders-v1',[]);
  let layer = null;
  let timer;

  function getCartEntries() {return Object.entries(cart).filter(([id,qty]) => PRODUCTS[id] && Number.isInteger(qty) && qty > 0);}
  function total() {return getCartEntries().reduce((sum,[id,qty]) => sum + PRODUCTS[id].price * qty,0);}
  function count() {return getCartEntries().reduce((sum,[,qty]) => sum + qty,0);}
  function notify(message) {const t=$('toast'); t.textContent=message;t.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('show'),2700);}
  function syncCount(){ $('cartCount').textContent=String(count()); $('cartCount').setAttribute('aria-label',count()+' items in cart'); }
  function addItem(id){if(!PRODUCTS[id])return;cart[id]=Math.min(99,(cart[id]||0)+1);save('gfumes-cart-v1',cart);syncCount();renderCart();notify('✓ '+PRODUCTS[id].name+' ADDED TO CART');}
  function changeQty(id,diff){if(!PRODUCTS[id])return;cart[id]=(cart[id]||0)+diff;if(cart[id]<=0)delete cart[id];cart[id]=Math.min(cart[id]||0,99);if(!cart[id])delete cart[id];save('gfumes-cart-v1',cart);syncCount();renderCart();}
  function renderCart(){
    const entries=getCartEntries(),root=$('cartItems');
    if(!entries.length){root.innerHTML='<div class="cart-empty"><span class="empty-symbol">∅</span><h3>YOUR CART IS EMPTY.</h3><p>Find something worth staying up for.</p></div>';}
    else root.innerHTML=entries.map(([id,qty])=>{const p=PRODUCTS[id];return `<div class="cart-item"><div class="cart-thumb"><img src="${thumb(p.thumb)}" alt="${safe(p.name)} model preview"></div><div><h4>${safe(p.name)}</h4><p>${safe(p.subtitle)}</p><div class="quantity-controls"><button data-qty="${id}" data-diff="-1" aria-label="Remove one ${safe(p.name)}">−</button><strong>${qty}</strong><button data-qty="${id}" data-diff="1" aria-label="Add one ${safe(p.name)}">+</button></div></div><div class="cart-line-price"><strong>${money(p.price*qty)}</strong><button class="remove-item" data-remove="${id}">REMOVE</button></div></div>`;}).join('');
    $('cartSubtotal').textContent=money(total());$('cartCheckout').disabled=!entries.length;
  }
  function setLayer(next){
    layer=next;
    $('backdrop').hidden=!next;
    $('cartDrawer').classList.toggle('open',next==='cart');$('cartDrawer').setAttribute('aria-hidden',next==='cart'?'false':'true');
    for(const id of ['checkout','orders']){const modal=$(id+'Modal');modal.classList.toggle('open',next===id);modal.setAttribute('aria-hidden',next===id?'false':'true');}
    document.body.style.overflow=next?'hidden':'';
    if(next==='cart')setTimeout(()=>$('cartClose').focus(),70);
    if(next==='checkout')setTimeout(()=>$('codename')?.focus(),80);
  }
  function checkout(){
    if(!count()){notify('YOUR CART CONTAINS THE WRONG KIND OF NOTHING');return;}
    $('checkoutContent').innerHTML=`<div class="checkout-warning">⚠ <b>ORDER PREVIEW.</b> This demo will not take payment, collect a shipping address, or ship products.</div><div class="checkout-rows" id="checkoutRows"></div><form id="checkoutForm"><label for="codename">AGENT CODENAME <span>(NO PERSONAL INFO)</span></label><input id="codename" name="codename" maxlength="30" placeholder="e.g. xX_AirGoblin_Xx" required autocomplete="off"/><label for="dimension">DESTINATION</label><select id="dimension" name="dimension"><option value="The Void">THE VOID</option><option value="Your Gaming Setup">YOUR GAMING SETUP</option><option value="1998">THE YEAR 1998</option><option value="An Alternate Timeline">AN ALTERNATE TIMELINE</option></select><label class="check-label"><input type="checkbox" id="acceptFake" required/><span>I understand no real order will be placed.</span></label><div class="subtotal-row checkout-total"><span>ORDER TOTAL</span><strong id="checkoutTotal">${money(total())}</strong></div><button type="submit" class="btn btn-lime checkout-submit">PLACE ORDER <span>↗</span></button></form>`;
    $('checkoutRows').innerHTML=getCartEntries().map(([id,qty])=>`<div class="checkout-row"><span>${qty} × ${safe(PRODUCTS[id].name)}</span><strong>${money(PRODUCTS[id].price*qty)}</strong></div>`).join('');
    $('checkoutForm').addEventListener('submit',submitOrder);
    setLayer('checkout');
  }
  function submitOrder(e){
    e.preventDefault();
    const codename=($('codename').value.trim()||'ANONYMOUS GOBLIN').slice(0,30);
    if(!$('acceptFake').checked)return;
    const dimension=$('dimension').value;
    const order={id:'GF-'+Math.random().toString(36).slice(2,8).toUpperCase(),date:new Date().toISOString(),codename,dimension,items:getCartEntries().map(([id,quantity])=>({id,quantity})),total:total()};
    orders.unshift(order);orders=orders.slice(0,40);save('gfumes-orders-v1',orders);cart={};save('gfumes-cart-v1',cart);syncCount();renderCart();
    $('checkoutContent').innerHTML=`<div class="success-view"><div class="success-icon">✓</div><span class="drawer-overline">OPERATION: ABSOLUTELY NOTHING / SUCCESSFUL</span><h3>YOU'VE BEEN SCAMMED BY THE CONCEPT OF COMMERCE.</h3><p>Congratulations, <b>${safe(codename)}</b>! Your fake order has been placed and will never be shipped. Nobody has charged you anything.</p><div class="receipt-box"><span class="receipt-label">YOUR COMPLETELY FAKE RECEIPT</span><div class="receipt-id">${order.id}</div><p>DESTINATION: ${safe(dimension.toUpperCase())}</p><p>IMAGINARY TOTAL: ${money(order.total)}</p><p>STATUS: LOST IN THE ATMOSPHERE</p></div><div class="success-actions"><button type="button" class="btn btn-outline" id="viewOrdersNow">MY ORDERS ↗</button><button type="button" class="btn btn-lime" id="successDone">BACK TO REALITY ↗</button></div></div>`;
    $('viewOrdersNow').addEventListener('click',renderOrders);$('successDone').addEventListener('click',()=>setLayer(null));
  }
  function renderOrders(){
    const root=$('ordersContent');
    if(!orders.length)root.innerHTML='<div class="order-empty"><strong>NO ORDERS IN THIS TIMELINE.</strong><p>Technically you haven\'t bought anything, which is exactly what our customers buy.</p><button class="btn btn-lime" id="goShop">GO SHOP NOTHING ↗</button></div>';
    else root.innerHTML='<div class="checkout-warning">LOCAL ARCHIVE ONLY. NOTHING IS CHARGED OR SHIPPED.</div>'+orders.map(o=>`<div class="order-history-item"><div class="order-id-line"><strong>${safe(o.id)}</strong><span>${safe(new Date(o.date).toLocaleDateString())}</span></div><p>AGENT: ${safe(o.codename)} · DESTINATION: ${safe(o.dimension)}<br>${o.items.map(item=>`${item.quantity} × ${safe(PRODUCTS[item.id]?.name||'MYSTERY AIR')}`).join(' / ')}<br>ORDER TOTAL: ${money(Number(o.total)||0)}</p><b>STATUS: LOST IN THE ATMOSPHERE</b></div>`).join('');
    setLayer('orders');
    $('goShop')?.addEventListener('click',()=>{setLayer(null);location.hash='#products';});
  }
  document.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',()=>addItem(btn.dataset.add)));
  $('cartOpen').addEventListener('click',()=>{renderCart();setLayer('cart');});
  $('cartClose').addEventListener('click',()=>setLayer(null));
  $('continueShopping').addEventListener('click',()=>setLayer(null));
  $('cartCheckout').addEventListener('click',checkout);
  ['ordersOpen','footerOrders','mobileOrders'].forEach(id=>$(id).addEventListener('click',()=>{closeMobileNav();renderOrders();}));
  $('backdrop').addEventListener('click',()=>setLayer(null));
  document.querySelectorAll('[data-close-modal]').forEach(btn=>btn.addEventListener('click',()=>setLayer(null)));
  $('cartItems').addEventListener('click',(e)=>{const q=e.target.closest('[data-qty]');const r=e.target.closest('[data-remove]');if(q)changeQty(q.dataset.qty,Number(q.dataset.diff));if(r){delete cart[r.dataset.remove];save('gfumes-cart-v1',cart);syncCount();renderCart();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setLayer(null);closeMobileNav();}});
  const menu=$('mobileNav');function closeMobileNav(){menu.classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false');}
  $('menuToggle').addEventListener('click',()=>{const open=menu.classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('.mobile-nav a').forEach(el=>el.addEventListener('click',closeMobileNav));

  const PHASES={idle:{speech:'AWAITING PRODUCT INPUT...',status:'IDLE'},unbox:{speech:'WAIT. IT\'S EMPTY?!',status:'UNBOXING_NOTHING'},hype:{speech:'OMG! +999 IMAGINARY FPS',status:'OVERHYPED'}};
  function setPhase(phase){
    if(!PHASES[phase])return;
    document.querySelectorAll('[data-phase]').forEach(b=>b.classList.toggle('active',b.dataset.phase===phase));
    $('demoSpeech').textContent=PHASES[phase].speech;$('demoStatus').textContent=PHASES[phase].status;
    $('demoParticles').dataset.phase=phase;
    $('demoParticles').style.opacity=phase==='idle'?'0':phase==='unbox'?'0.7':'1';
    document.dispatchEvent(new CustomEvent('gfumes:phase',{detail:{phase}}));
  }
  document.querySelectorAll('[data-phase]').forEach(btn=>btn.addEventListener('click',()=>setPhase(btn.dataset.phase)));
  const particles=$('demoParticles');
  for(let i=0;i<28;i++){
    const p=document.createElement('span');p.className='particle';p.style.setProperty('--size',(3+Math.random()*13)+'px');p.style.setProperty('--duration',(2.2+Math.random()*2.4)+'s');p.style.setProperty('--delay',(-Math.random()*5)+'s');p.style.setProperty('--x',(-110+Math.random()*180)+'px');p.style.setProperty('--y',(-80-Math.random()*190)+'px');p.style.left=(57+Math.random()*16)+'%';particles.appendChild(p);
  }
  particles.style.opacity='0';
  $('hypeSlider').addEventListener('input',e=>{const value=Number(e.target.value);$('hypeNumber').textContent=value+'%';particles.querySelectorAll('.particle').forEach((p,i)=>{p.style.animationDuration=(2.3+(100-value)*.025+(i%5)*.13)+'s';p.style.filter='brightness('+(0.7+value/100)+')';});document.dispatchEvent(new CustomEvent('gfumes:hype',{detail:{value}}));});

  if(window.GFUMES_USE_LOCAL_ASSETS){document.querySelectorAll(`img[src^="${REMOTE}"]`).forEach(img=>{img.src=thumb(img.src.slice(REMOTE.length));});}
  // Personalize the creator drop for screenshots or a shareable URL.
  const params=new URLSearchParams(location.search);
  const normalizeCreator=s=>String(s||'').trim().replace(/[^a-zA-Z0-9_ .@-]/g,'').slice(0,24).toUpperCase();
  let creator=normalizeCreator(params.get('collab'))||normalizeCreator(load('gfumes-creator-v1','YOUR_HANDLE'))||'YOUR_HANDLE';
  function renderCreator(){ $('creatorName').textContent=creator;document.title='GFUMES × '+creator+' - THE FUTURE IS EMPTY'; }
  $('editCreator').addEventListener('click',()=>{const entered=prompt('Set your GFUMES creator name (gamer tag only):',creator);if(entered===null)return;creator=normalizeCreator(entered)||'YOUR_HANDLE';save('gfumes-creator-v1',creator);renderCreator();notify('CREATOR DROP UPDATED');});
  $('shareCreator').addEventListener('click',async()=>{const link=new URL(location.href);link.searchParams.set('collab',creator);link.hash='';try{await navigator.clipboard.writeText(link.toString());notify('GFUMES CREATOR LINK COPIED');}catch{prompt('Copy your GFUMES creator link:',link.toString());}});
  renderCreator();
  syncCount();renderCart();
})();
