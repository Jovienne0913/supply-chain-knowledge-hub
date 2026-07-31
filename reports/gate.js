// gate.js — 锦泓供应链知识库统一门禁（含1小时跨子页会话）
// 用法：每个子页保留 #scGate 门禁HTML，并在 body 末尾引入 <script src="gate.js"></script>
// 1h 会话：验证通过后把时间戳写入 localStorage（同源子页共享），1h 内访问任意子页免重复验证。


// ===== 供应链知识库门禁 (形态A：后端真门禁；前端仅渲染 UX) =====
// 主形态：8 位工号(103 开头) 核验，后端记载
// 备选：配置企微凭据扫码 / 演示模式(无后端预览)
(function(){
  function $(id){return document.getElementById(id);}
  var SESSION_KEY='kb_gate_auth';
  var SESSION_TTL=3600*1000; // 1小时
  var GATE = window.KB_GATE || {wecom:false, code:false, employee:true, mock:true};

  function removeMask(){
    var m=$('scGate');if(!m)return;
    m.style.transition='opacity .25s';m.style.opacity='0';
    setTimeout(function(){
      if(m.parentNode)m.parentNode.removeChild(m);
      if(m.getAttribute('data-shell'))window.location.reload();
    },250);
  }
  function authed(){removeMask();try{localStorage.setItem(SESSION_KEY,String(Date.now()));}catch(e){}}
  function showErr(msg){var e=$('scGateErr');if(e){e.textContent=msg||'';if(msg){e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');}}}
  function setHint(html){var h=$('scGateHint');if(h)h.innerHTML=html;}
  function hideWecom(){var qr=$('scGateQr');if(qr)qr.style.display='none';var d=$('scGateDivider');if(d)d.style.display='none';}
  function focusCard(){try{var f=$('scGate').querySelector('.sc-gate-card');if(f){f.setAttribute('tabindex','-1');f.focus();}}catch(e){}}

  // 工号核验
  function startEmp(demo){
    hideWecom();
    var idI=$('scGateEmpId'), btn=$('scGateEmpBtn');
    if(!idI||!btn)return;
    function submit(){
      var id=idI.value.trim();
      if(!/^103\d{5}$/.test(id)){showErr('工号无效');return;}
      if(demo){ showErr(''); authed(); return; }
      showErr(''); btn.disabled=true; btn.textContent='验证中…';
      fetch('/api/auth/employee',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({emp_id:id}),credentials:'same-origin'})
        .then(function(r){return r.json().then(function(d){return {ok:r.ok&&d.ok,d:d};});})
        .then(function(res){
          if(res.ok){ authed(); }
          else { showErr((res.d&&res.d.msg)||'验证失败'); btn.disabled=false; btn.textContent='验证进入'; }
        })
        .catch(function(){ showErr('网络异常，无法连接门禁服务'); btn.disabled=false; btn.textContent='验证进入'; });
    }
    btn.onclick=submit;
    idI.addEventListener('keydown',function(e){if(e.key==='Enter')submit();});
    idI.focus();
  }

  // 演示模式（无后端 / ?demo=1）
  function showDemo(){
    var d=$('scGateDemo');if(d)d.style.display='block';
    hideWecom();
    var de=$('scGateDemoEnter');
    if(de)de.onclick=function(){
      var id=$('scGateEmpId');
      if(id&&/^103\d{5}$/.test(id.value.trim())){ showErr(''); authed(); }
      else showErr('工号无效');
    };
    startEmp(true);
  }

  // 企业微信扫码（仅在配置企微凭据时）
  function qrSVG(){
    var N=25, cell=100/N, parts=['<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">','<rect width="100" height="100" fill="#fff"/>'];
    var seed=20260730;
    function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}
    function finder(x,y){
      parts.push('<rect x="'+(x*cell)+'" y="'+(y*cell)+'" width="'+(7*cell)+'" height="'+(7*cell)+'" fill="#1f2937"/>');
      parts.push('<rect x="'+((x+1)*cell)+'" y="'+((y+1)*cell)+'" width="'+(5*cell)+'" height="'+(5*cell)+'" fill="#fff"/>');
      parts.push('<rect x="'+((x+2)*cell)+'" y="'+((y+2)*cell)+'" width="'+(3*cell)+'" height="'+(3*cell)+'" fill="#1f2937"/>');
    }
    for(var y=0;y<N;y++){for(var x=0;x<N;x++){
      if((x<8&&y<8)||(x>N-9&&y<8)||(x<8&&y>N-9))continue;
      if(rnd()>0.55){parts.push('<rect x="'+(x*cell)+'" y="'+(y*cell)+'" width="'+cell+'" height="'+cell+'" fill="#1f2937"/>');}
    }}
    finder(0,0);finder(N-7,0);finder(0,N-7);
    parts.push('</svg>');return parts.join('');
  }
  function setQRState(s,badge,txt){
    var qr=$('scGateQr');if(!qr)return;
    qr.className='sc-gate-qr state-'+s;
    var b=$('scGateBadge'),t=$('scGateMaskTxt');
    if(b)b.textContent=badge;if(t)t.textContent=txt;
  }
  function poll(ticket){
    var iv=setInterval(function(){
      fetch('/api/auth/wecom/status?ticket='+encodeURIComponent(ticket),{credentials:'same-origin'})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.state==='scanned'){setQRState('scanned','✓','已在手机端扫描，请确认');setHint('已扫描 · 请在手机端点击<b>确认</b>');}
        else if(d.state==='expired'){clearInterval(iv);setQRState('expired','!','二维码已过期');}
        else if(d.state==='success'){clearInterval(iv);setHint('验证通过 · 正在进入…');authed();}
      }).catch(function(){});
    },2000);
  }
  function startWecom(ticket,loginUrl){
    var qr=$('scGateQr');if(!qr)return;
    qr.style.display='block';
    qr.innerHTML='<iframe src="'+loginUrl+'" title="企业微信扫码登录" style="width:100%;height:100%;border:0;border-radius:6px;"></iframe>'
      +'<div class="qr-fallback"><a href="'+loginUrl+'" target="_blank" rel="noopener">无法显示？点此在新窗口扫码</a></div>';
    setHint('请使用企业微信 App 扫描上方二维码');
    poll(ticket);
  }

  function isStaticHost(){
    var h=location.hostname;
    return h.indexOf('github.io')>=0 || h==='localhost' || h==='127.0.0.1' || h==='0.0.0.0';
  }

  function init(){
    // 1小时客户端会话：同源子页共享 localStorage，1h 内免重复验证
    try{var _at=parseInt(localStorage.getItem(SESSION_KEY)||'0',10);if(_at&&(Date.now()-_at)<SESSION_TTL){authed();return;}}catch(e){}
    var mask=$('scGate');if(!mask)return;
    if(/[?&]demo=1/.test(location.search)||isStaticHost()){showDemo();focusCard();return;}
    fetch('/api/auth/me',{credentials:'same-origin'})
      .then(function(r){return r.status===200?r.json().then(function(d){return{ok:true,d:d};}):{ok:false};})
      .then(function(res){
        if(res.ok){authed();return;}
        return fetch('/api/auth/config',{credentials:'same-origin'})
          .then(function(r){return r.json();})
          .then(function(cfg){
            GATE=cfg||GATE;
            if(cfg&&cfg.employee){ startEmp(false); }
            else if(cfg&&cfg.wecom){ fetch('/api/auth/wecom/qrcode',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){startWecom(d.ticket,d.login_url);}).catch(function(){showDemo();}); }
            else { showDemo(); }
          })
          .catch(function(){ showDemo(); });
      })
      .catch(function(){ showDemo(); });
    focusCard();
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();

