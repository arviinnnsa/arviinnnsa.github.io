/* Errands street scene: 1200x760, same illustration style as the planner's scenes.
   Each shop's sign + window light up when its errand is ticked (class "lit" on .shop). */
window.STREET_SVG=(function(){
  const shops=[
    {x:70, w:250,name:'DENTAL',  c:'#9fd3ff',win:'#cfe6ff',aw:'#3b5f86'},
    {x:340,w:250,name:'PHARMACY',c:'#7ee0a8',win:'#d8f5e4',aw:'#2f6a4f',cross:true},
    {x:610,w:250,name:'POST',    c:'#ff9b6b',win:'#ffe0c9',aw:'#8a3f2a'},
    {x:880,w:250,name:'MARKET',  c:'#ffd36b',win:'#fff0c4',aw:'#8a6a24'}];
  let s=`<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151a33"/><stop offset=".6" stop-color="#3a2d4f"/><stop offset="1" stop-color="#6b4a62"/></linearGradient>
    <linearGradient id="street" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2530"/><stop offset="1" stop-color="#141218"/></linearGradient>
    <linearGradient id="walk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4048"/><stop offset="1" stop-color="#35303a"/></linearGradient>
    <radialGradient id="lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter>
  </defs>
  <rect width="1200" height="760" fill="url(#sky)"/>`;
  // stars
  for(let i=0;i<40;i++){const x=(i*137)%1200,y=(i*71)%170+10;s+=`<circle cx="${x}" cy="${y}" r="${1+(i%3)*.4}" fill="#fff" opacity="${.15+(i%5)*.06}"/>`}
  // far skyline
  s+=`<path d="M0 300 L0 210 L60 210 L60 170 L120 170 L120 230 L180 230 L180 150 L230 150 L230 120 L270 120 L270 200 L340 200 L340 175 L400 175 L400 240 L470 240 L470 140 L520 140 L520 100 L560 100 L560 190 L640 190 L640 160 L700 160 L700 220 L760 220 L760 130 L820 130 L820 200 L900 200 L900 170 L960 170 L960 240 L1020 240 L1020 150 L1080 150 L1080 205 L1140 205 L1140 175 L1200 175 L1200 300 Z" fill="#241f35" opacity=".9"/>`;
  for(let i=0;i<70;i++){const x=(i*173)%1180+8,y=(i*97)%140+120;s+=`<rect x="${x}" y="${y}" width="5" height="7" fill="#ffd9a0" opacity="${.08+(i%4)*.05}"/>`}
  // building row
  s+=`<rect x="40" y="250" width="1120" height="330" fill="#2b2433"/><rect x="40" y="250" width="1120" height="10" fill="#3a3145"/>`;
  for(let i=0;i<14;i++){const x=70+i*78;s+=`<rect x="${x}" y="280" width="34" height="44" rx="3" fill="#1d1824"/><rect x="${x}" y="280" width="34" height="44" rx="3" fill="#ffcf8f" opacity="${[0,.18,0,.1,0,0,.22,0,.12,0,0,.16,0,0][i]}"/>`}
  // shops
  shops.forEach((p,i)=>{const cx=p.x+p.w/2;
    s+=`<g class="shop" data-i="${i}" style="--sc:${p.c}">
      <rect x="${p.x}" y="350" width="${p.w}" height="230" fill="#231d29"/>
      <rect class="win" x="${p.x+18}" y="430" width="${p.w*.55}" height="120" rx="4" fill="#15121a"/>
      <rect class="winlit" x="${p.x+18}" y="430" width="${p.w*.55}" height="120" rx="4" fill="${p.win}"/>
      <g class="winstuff" opacity=".0">${[0,1,2].map(k=>`<rect x="${p.x+30+k*40}" y="${500-k*8}" width="26" height="${40+k*8}" rx="3" fill="${p.aw}" opacity=".55"/>`).join('')}</g>
      <rect x="${p.x+p.w*.55+34}" y="440" width="${p.w*.45-52}" height="140" rx="3" fill="#18141d"/>
      <circle cx="${p.x+p.w-28}" cy="515" r="3" fill="#8a7f6a"/>
      <path d="M${p.x+8} 410 L${p.x+p.w-8} 410 L${p.x+p.w-20} 380 L${p.x+20} 380 Z" fill="${p.aw}" opacity=".85"/>
      ${[...Array(7)].map((_,k)=>`<rect x="${p.x+20+k*((p.w-40)/7)}" y="380" width="${(p.w-40)/14}" height="30" fill="#000" opacity=".12"/>`).join('')}
      <rect class="glow" x="${cx-88}" y="352" width="176" height="34" rx="6" fill="${p.c}" filter="url(#glow)"/>
      <rect x="${cx-84}" y="355" width="168" height="28" rx="5" fill="#1a1620" stroke="#3a3343" stroke-width="2"/>
      <text class="sign" x="${cx+(p.cross?12:0)}" y="375" text-anchor="middle" font-family="Hanken Grotesk,Helvetica,Arial,sans-serif" font-weight="700" font-size="16" letter-spacing="${p.cross?1.5:3}">${p.name}</text>
      ${p.cross?`<path class="signx" d="M${cx-74} 362 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 z"/>`:''}
      <polygon class="spill" points="${p.x+18},550 ${p.x+18+p.w*.55},550 ${p.x+p.w*.55+60},640 ${p.x-20},640" fill="${p.win}"/>
    </g>`});
  // sidewalk, curb, road
  s+=`<rect x="0" y="580" width="1200" height="60" fill="url(#walk)"/><rect x="0" y="636" width="1200" height="8" fill="#5a5058"/>
  <rect x="0" y="644" width="1200" height="116" fill="url(#street)"/>
  ${[0,1,2,3,4,5].map(k=>`<rect x="${40+k*210}" y="700" width="110" height="5" rx="2" fill="#d8c9a8" opacity=".25"/>`).join('')}`;
  // street lamps
  [330,860].forEach(x=>{s+=`<circle cx="${x}" cy="300" r="90" fill="url(#lamp)" class="lampglow"/><rect x="${x-3}" y="300" width="6" height="282" fill="#1a1720"/><path d="M${x-16} 292 h32 l-6 14 h-20z" fill="#2a2530"/><ellipse cx="${x}" cy="306" rx="9" ry="3" fill="#ffe2b0"/>`});
  // parked car (small hatchback)
  s+=`<g transform="translate(470 610)"><path d="M0 70 L0 45 Q4 30 30 26 L70 6 Q90 0 150 0 Q185 0 205 22 L240 30 Q262 34 262 52 L262 70 Z" fill="#1d2230"/>
    <path d="M78 12 Q92 6 150 6 Q178 6 194 24 L82 26 Z" fill="#3a4560" opacity=".8"/><rect x="132" y="7" width="5" height="19" fill="#1d2230"/>
    <circle cx="58" cy="72" r="22" fill="#0e0e12"/><circle cx="58" cy="72" r="9" fill="#55586a"/><circle cx="210" cy="72" r="22" fill="#0e0e12"/><circle cx="210" cy="72" r="9" fill="#55586a"/>
    <rect x="248" y="40" width="12" height="8" rx="2" fill="#ffe8b0" opacity=".9"/><rect x="2" y="38" width="10" height="8" rx="2" fill="#ff6b5b" opacity=".8"/></g>`;
  return s})();
