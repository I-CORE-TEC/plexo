# :material-calculator-variant-outline: Planilla de Estimación de Horas

!!! abstract "Plantilla"
    Estimación formal de un requerimiento. Se presenta como **rango (mínimo / máximo)** para contemplar variabilidad. La aprobación llega por email desde una casilla oficial de OSTEL y el PM deja constancia en el Issue antes de iniciar el desarrollo.

---

## :material-information-outline: Metadatos

| Campo | Valor |
|---|---|
| :material-folder-outline: **Proyecto** | OSTEL — Implementación de PLEXO |
| :material-link-variant: **Issue** | `#<número>` — *Título del requerimiento* |
| :material-calendar-outline: **Fecha de estimación** | `YYYY-MM-DD` |
| :material-account-edit-outline: **Estimado por** | *Nombre del estimador* |

---

## :material-text-box-outline: Descripción del requerimiento

!!! quote ""
    *Resumen breve del requerimiento a estimar.*

---

## :material-format-list-numbered: Desglose por etapa

| Etapa | Horas mín. | Horas máx. | Notas |
|---|:-:|:-:|---|
| :material-clipboard-search-outline: Análisis | *N* | *N* | *Observaciones* |
| :material-book-open-page-variant-outline: Documentación | *N* | *N* | *Observaciones* |
| :material-code-braces: Desarrollo | *N* | *N* | *Observaciones* |
| :material-test-tube: Pruebas | *N* | *N* | *Observaciones* |
| :material-school-outline: Capacitación | *N* | *N* | Solo si aplica |
| :material-rocket-launch-outline: Despliegue | *N* | *N* | *Observaciones* |
| **:material-sigma: TOTAL** | **N** | **N** | |

---

## :material-shield-check-outline: Supuestos y condiciones

!!! info "Si alguno cambia, la estimación puede variar"

    - [x] El entorno de pruebas está disponible y funcionando.
    - [x] No hay cambios de alcance durante el desarrollo.
    - [x] La documentación de origen necesaria fue entregada por OSTEL.
    - [x] OSTEL responde consultas dentro de los plazos acordados (ver Metodología).
    - [ ] *Agregar otros supuestos*

---

## :material-alert-octagon-outline: Riesgos que pueden impactar la estimación

| Riesgo | Probabilidad | Impacto estimado |
|---|:-:|:-:|
| *Riesgo* | Alta / Media / Baja | +*N* hs |

---

## :material-wallet-outline: Saldo de horas del cliente

| Concepto | Valor |
|---|---|
| :material-counter: **Saldo actual** | *N hs* *(a validar con el PM antes de confirmar)* |
| :material-clock-alert-outline: **Horas requeridas (rango)** | *N – N hs* |
| :material-check-circle-outline: **¿Saldo suficiente?** | Sí / No — si no, indicar qué hacer |

---

## :material-check-decagram-outline: Aprobación del cliente

!!! quote "Constancia de aprobación"
    La estimación fue presentada y aprobada por:

    - :material-account-outline: **Nombre:** *Referente institucional de OSTEL*
    - :material-calendar-check-outline: **Fecha de aprobación:** `YYYY-MM-DD`
    - :material-message-outline: **Medio:** Email desde casilla oficial (asunto y fecha)

---

!!! warning "Antes de iniciar el desarrollo"
    Contar con el **email de aprobación** de OSTEL y dejar constancia en el issue `#N` (fecha, remitente y asunto).
