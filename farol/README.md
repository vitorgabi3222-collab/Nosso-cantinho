# Meu farol, minha casa

Site interativo e poético, feito em HTML, CSS e JavaScript puros. Não precisa de servidor, de instalação nem de recursos pagos.

## O que tem aqui

```
index.html        a página
css/style.css     estilos
js/sea.js         cena 1: o farol no mar turbulento
js/tree.js        cena 2: a árvore de corações
js/music.js       player do Spotify
js/main.js        transição entre as cenas e animações de entrada
```

## Como publicar no GitHub Pages (grátis)

1. Entre em [github.com](https://github.com) e crie um repositório novo e público, por exemplo `meu-farol`.
2. Clique em **Add file → Upload files** e arraste **todo o conteúdo desta pasta** (o `index.html` precisa ficar na raiz, junto das pastas `css` e `js`).
3. Confirme em **Commit changes**.
4. Vá em **Settings → Pages**. Em **Source**, escolha **Deploy from a branch**, depois o branch **main** e a pasta **/ (root)**, e salve.
5. Espere de 1 a 3 minutos. O endereço aparece no topo da página de Pages, no formato `https://SEU-USUARIO.github.io/meu-farol/`.

Se o site já estiver publicado e você só quiser atualizar, envie os arquivos novos e confirme o commit.

## Como colocar a música

1. No Spotify, abra **93 Million Miles**, de Jason Mraz, clique em **Compartilhar → Copiar link da música**.
2. Abra o arquivo `js/music.js` e cole o link entre as aspas da linha `const SPOTIFY_URL = '';`.
3. Salve e publique de novo.

A música só toca depois do clique em **Acenda essa luz ♡**. Quem não estiver logado no Spotify no navegador ouve apenas um trecho de 30 segundos, por regra do próprio Spotify. Se o navegador pedir mais uma confirmação, aparece um aviso que leva até o player, onde basta apertar o play.

## Como mudar os textos

Todos os textos estão no `index.html`. As datas ficam na seção `id="datas"` e as frases principais nas seções `id="peak"` e `id="mensagem"`.
