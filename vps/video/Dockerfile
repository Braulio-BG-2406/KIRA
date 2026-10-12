# Kira — serviço de vídeo (faixa de texto nos Reels). Imagem pequena: Python + ffmpeg + fonte DejaVu.
FROM python:3.12-alpine
RUN apk add --no-cache ffmpeg font-dejavu
COPY servidor.py /app/servidor.py
USER nobody
EXPOSE 8080
CMD ["python3", "-u", "/app/servidor.py"]
