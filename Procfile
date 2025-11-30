web: gunicorn redmusical.wsgi:application --bind 0.0.0.0:$PORT
worker: python manage.py process_spotify_queue --loop
