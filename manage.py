#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

# --- Variables de entorno temporales para AudD (DESARROLLO LOCAL) ---
# Reemplaza el valor por tu clave real y no lo subas al repositorio.
os.environ.setdefault("AUDD_API_KEY", "739112cfc57a0387ba9f46574fcd6daa")
# Activa debug para ver la respuesta cruda en la consola (true/false)
os.environ.setdefault("DEBUG_AUDD", "true")

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'redmusical.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
