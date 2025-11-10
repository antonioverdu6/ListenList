"""Compatibility wrapper: import the script from the musica package.

This file kept at project root for backward compatibility; the real implementation
is in `musica.scripts.print_artist_rating`.
"""
import importlib

importlib.import_module('musica.scripts.print_artist_rating')
