web: daphne -b 0.0.0.0 -p $PORT redmusical.asgi:application
worker: python manage.py process_spotify_queue --loop
