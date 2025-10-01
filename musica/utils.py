from datetime import date, datetime

def formatear_fecha(fecha):
    """
    Formatea la fecha para mostrarla en plantillas.
    Si recibe un string, intenta convertirlo a datetime.
    """
    if isinstance(fecha, str):
        try:
            fecha = datetime.strptime(fecha, "%Y-%m-%d")
        except ValueError:
            try:
                fecha = datetime.strptime(fecha, "%Y-%m")
            except ValueError:
                try:
                    fecha = datetime.strptime(fecha, "%Y")
                except ValueError:
                    return fecha  # No se pudo parsear, devolver tal cual

    return fecha.strftime("%d/%m/%Y")



def normalizar_fecha(fecha):
    """
    Convierte '1982', '1982-10' o '1982-10-05' en un objeto date válido.
    Si no se puede, devuelve None.
    """
    if isinstance(fecha, str):
        try:
            if len(fecha) == 4:  # Solo año
                return date(int(fecha), 1, 1)
            elif len(fecha) == 7:  # Año y mes
                year, month = map(int, fecha.split('-'))
                return date(year, month, 1)
            elif len(fecha) == 10:  # Año, mes y día
                year, month, day = map(int, fecha.split('-'))
                return date(year, month, day)
        except ValueError:
            return None

    return fecha


def formatear_duracion(duracion):
    if not duracion:
        return ""

    total_seconds = int(duracion.total_seconds())
    horas, resto = divmod(total_seconds, 3600)
    minutos, segundos = divmod(resto, 60)

    partes = []
    if horas > 0:
        partes.append(f"{horas} {'hora' if horas == 1 else 'horas'}")
    if minutos > 0:
        partes.append(f"{minutos} {'minuto' if minutos == 1 else 'minutos'}")
    if segundos > 0 or (horas == 0 and minutos == 0):
        partes.append(f"{segundos} {'segundo' if segundos == 1 else 'segundos'}")

    return " y ".join(partes)