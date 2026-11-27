"""One-page synthetic PDFs without a rendering dependency."""


def pdf_una_pagina(lineas):
    flujo = b"BT /F1 11 Tf 56 780 Td 18 TL\n"
    for tam, linea in lineas:
        # Helvetica with WinAnsi supports the Spanish fixture labels.
        texto = linea.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").encode("cp1252")
        flujo += b"/F1 %d Tf (" % tam + texto + b") Tj T*\n"
    flujo += b"ET"
    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length %d >>\nstream\n" % len(flujo) + flujo + b"\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    posiciones = []
    for n, objeto in enumerate(objetos, 1):
        posiciones.append(len(pdf))
        pdf += b"%d 0 obj\n" % n + objeto + b"\nendobj\n"
    xref = len(pdf)
    pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1)
    pdf += b"".join(b"%010d 00000 n \n" % p for p in posiciones)
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objetos) + 1, xref)
    return pdf
