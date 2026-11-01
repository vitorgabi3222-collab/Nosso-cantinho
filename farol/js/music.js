/* ==========================================================================
   music.js  ·  Player incorporado (Spotify ou YouTube)
   A música só começa depois do clique em "Acenda essa luz". Nenhum arquivo de
   áudio é usado: tudo passa pelo player oficial incorporado.
   Prioridade: Spotify (se houver link) e, senão, YouTube.
   API pública:  Music.play()  Music.toggle()  Music.isPlaying()  Music.onChange(fn)
   ========================================================================== */
const Music = (function () {
  'use strict';

  /* >>> COLE AQUI o link de compartilhamento de "93 Million Miles" (Jason Mraz) no Spotify.
         Exemplo de formato: https://open.spotify.com/track/XXXXXXXXXXXXXXXXXXXXXX  */
  const SPOTIFY_URL = '';

  /* Enquanto não houver link do Spotify, a música toca pelo player do YouTube. */
  const YOUTUBE_URL = 'https://youtu.be/BYO0vnn874M';

  const box = document.getElementById('player');
  const SEARCH_URL = 'https://open.spotify.com/search/93%20Million%20Miles%20Jason%20Mraz';
  let ctrl = null, wantPlay = false, playing = false;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn(playing));

  const m = SPOTIFY_URL.match(/\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
  const y = YOUTUBE_URL.match(/(?:youtu\.be\/|[?&]v=|embed\/)([\w-]{11})/);

  /* Sem link configurado: mostra um botão que abre a busca da música no Spotify */
  function showFallback() {
    box.innerHTML = '<div class="player-fallback"><p>Para ouvir, abra a música no Spotify.</p><a href="' + SEARCH_URL + '" target="_blank" rel="noopener">Abrir no Spotify</a></div>';
  }

  /* Player simples (iframe), usado se a API do Spotify não carregar */
  function plainIframe(kind, id) {
    if (ctrl || box.querySelector('iframe')) return;
    const f = document.createElement('iframe');
    f.src = 'https://open.spotify.com/embed/' + kind + '/' + id + '?theme=0';
    f.height = '152'; f.title = '93 Million Miles no Spotify'; f.loading = 'lazy';
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    box.appendChild(f);
  }

  if (!m && y) {
    /* ---------- YouTube ---------- */
    box.classList.add('yt');
    const mount = document.createElement('div'); box.appendChild(mount);
    let yt = null;
    window.onYouTubeIframeAPIReady = function () {
      yt = new YT.Player(mount, {
        width: '100%', height: '100%', videoId: y[1],
        playerVars: { playsinline: 1, rel: 0, loop: 1, playlist: y[1] },
        events: {
          onReady: function () { ctrl = { play: function () { yt.playVideo(); }, togglePlay: function () { playing ? yt.pauseVideo() : yt.playVideo(); } }; if (wantPlay) yt.playVideo(); },
          onStateChange: function (e) { const now = e.data === 1; if (now !== playing) { playing = now; emit(); } }
        }
      });
    };
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true;
    document.body.appendChild(sc);
  } else if (!m) {
    showFallback();
  } else {
    const kind = m[1], id = m[2];
    const mount = document.createElement('div'); box.appendChild(mount);
    window.onSpotifyIframeApiReady = function (IFrameAPI) {
      IFrameAPI.createController(mount, { uri: 'spotify:' + kind + ':' + id, width: '100%', height: 152 }, function (c) {
        ctrl = c;
        c.addListener('ready', function () { if (wantPlay) c.play(); });
        c.addListener('playback_update', function (e) {
          const now = !!(e.data && !e.data.isPaused);
          if (now !== playing) { playing = now; emit(); }
        });
      });
    };
    const sc = document.createElement('script');
    sc.src = 'https://open.spotify.com/embed/iframe-api/v1'; sc.async = true;
    sc.onerror = function () { plainIframe(kind, id); };
    document.body.appendChild(sc);
    setTimeout(function () { plainIframe(kind, id); }, 8000);   // rede lenta: garante que o player apareça
  }

  return {
    /* Chamado dentro do clique da visitante (exigência dos navegadores) */
    play: function () { wantPlay = true; if (ctrl) ctrl.play(); },
    toggle: function () { if (ctrl) ctrl.togglePlay(); },
    isPlaying: function () { return playing; },
    hasController: function () { return !!ctrl; },
    onChange: function (fn) { listeners.push(fn); }
  };
})();
