/* ==========================================================================
   main.js  ·  Orquestra as duas cenas, a transição e as animações de entrada
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const btn = $('light-btn'), scene1 = $('scene1'), scene2 = $('scene2');
  const toggle = $('music-toggle'), pill = $('music-pill');
  let started = false;

  /* ---------- Transição: da tempestade para o acolhimento ---------- */
  btn.addEventListener('click', function () {
    if (started) return;
    started = true;
    btn.classList.add('pressed');

    Music.play();               // 1) inicia a música (precisa estar dentro do clique)
    Sea.lightUp();              // 2) a luz do farol brilha muito mais
    body.classList.add('transition');   // 3) clarão dourado

    // 4) a segunda cena surge enquanto a primeira se dissolve
    setTimeout(function () {
      scene1.classList.add('out');
      scene2.classList.add('in');
      Tree.start();
      body.classList.remove('lock');
      window.scrollTo(0, 0);
    }, 1900);

    // 5) limpeza: pausa o mar e libera os controles da música
    setTimeout(function () {
      Sea.stop();
      scene1.hidden = true;
      body.classList.remove('transition');
      toggle.classList.add('on');
      watchMusic();
    }, 5300);
  });

  /* ---------- Controles da música ---------- */
  function setToggle() { toggle.textContent = Music.isPlaying() ? '❚❚' : '♪'; }
  toggle.addEventListener('click', function () {
    if (Music.hasController()) Music.toggle();
    else $('player').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  Music.onChange(function () { setToggle(); if (Music.isPlaying()) pill.hidden = true; });

  /* Se o Spotify exigir mais uma confirmação, mostra o aviso que leva até o player */
  function watchMusic() {
    setTimeout(function () {
      if (Music.isPlaying()) return;
      pill.hidden = false;
      setTimeout(function () { pill.hidden = true; }, 12000);   // some sozinho; o botão da música continua
    }, 2500);
  }
  pill.addEventListener('click', function () {
    pill.hidden = true;
    $('player').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---------- Frase principal: cada palavra aparece em sequência ---------- */
  const peak = $('peak-text');
  const words = peak.textContent.trim().split(/\s+/);
  peak.setAttribute('aria-label', words.join(' '));
  peak.innerHTML = words.map(function (w, i) {
    return '<span class="w" style="--i:' + i + '" aria-hidden="true">' + w + '</span> ';
  }).join('');

  /* ---------- Textos que surgem ao rolar ---------- */
  const targets = document.querySelectorAll('.reveal, .peak');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('in'); });
  }
})();
