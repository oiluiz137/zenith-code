---
name: corte-viral
description: Transforma um vídeo longo em cortes verticais curtos com trechos que funcionam sozinhos. Use para pedidos de cortes para Shorts, Reels ou TikTok.
---

# Cortes verticais

Versão original escrita para o Zenith. Requer ffmpeg instalado.

1. Transcreva o áudio (Whisper local, quando disponível) e marque trechos com início e fim.
2. Escolha trechos de 20 a 60 segundos que tenham uma ideia completa.
3. Corte com `ffmpeg -ss <início> -to <fim> -i <entrada> <saída>`.
4. Para formato vertical, use `scale` e `crop` para 1080x1920.
5. Liste os cortes com o motivo de cada escolha.
