#!/usr/bin/env python
"""
Script para verificar configuración de producción
Ejecutar: python check_config.py
"""

import os
import sys

def check_config():
    print("🔍 Verificando configuración de producción...\n")
    
    errors = []
    warnings = []
    
    # Verificar SECRET_KEY
    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key:
        errors.append("❌ SECRET_KEY no está configurada")
    elif secret_key == 'django-insecure-dg*#8-(zykqgo$2iik%%n1i62c-ya3z_o(mk+701)@xe%1x#(z':
        errors.append("❌ SECRET_KEY todavía usa el valor por defecto inseguro")
    else:
        print("✅ SECRET_KEY configurada")
    
    # Verificar DEBUG
    debug = os.environ.get('DEBUG', 'False')
    if debug == 'True':
        warnings.append("⚠️  DEBUG=True en producción no es recomendado")
    else:
        print("✅ DEBUG=False")
    
    # Verificar DATABASE_URL
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("✅ DATABASE_URL no configurada (usará SQLite - OK)")
    elif 'sqlite' in database_url:
        print("✅ DATABASE_URL configurada (SQLite)")
    else:
        print("✅ DATABASE_URL configurada (PostgreSQL)")
    
    # Verificar FRONTEND_URL
    frontend_url = os.environ.get('FRONTEND_URL')
    if not frontend_url:
        warnings.append("⚠️  FRONTEND_URL no configurada")
    else:
        print(f"✅ FRONTEND_URL: {frontend_url}")
    
    # Verificar RENDER_EXTERNAL_HOSTNAME
    render_host = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
    if not render_host:
        warnings.append("⚠️  RENDER_EXTERNAL_HOSTNAME no configurada")
    else:
        print(f"✅ RENDER_EXTERNAL_HOSTNAME: {render_host}")
    
    # Verificar archivos
    print("\n📁 Verificando archivos...")
    required_files = [
        'Procfile',
        'build.sh',
        'runtime.txt',
        'requirements.txt',
    ]
    
    for file in required_files:
        if os.path.exists(file):
            print(f"✅ {file} existe")
        else:
            errors.append(f"❌ {file} no encontrado")
    
    # Resumen
    print("\n" + "="*50)
    if errors:
        print("\n❌ ERRORES CRÍTICOS:")
        for error in errors:
            print(f"  {error}")
    
    if warnings:
        print("\n⚠️  ADVERTENCIAS:")
        for warning in warnings:
            print(f"  {warning}")
    
    if not errors and not warnings:
        print("\n✅ ¡Todo está configurado correctamente!")
    elif not errors:
        print("\n✅ No hay errores críticos, pero hay algunas advertencias")
    
    print("="*50 + "\n")
    
    return len(errors) == 0

if __name__ == '__main__':
    success = check_config()
    sys.exit(0 if success else 1)
