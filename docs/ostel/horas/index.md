# :material-clock-check-outline: Consumo de horas

!!! abstract "Seguimiento del paquete de horas"
    Vista del paquete de horas contratado por OSTEL y de su consumo. Da visibilidad centralizada de cuántas horas se usaron, en qué y cuántas quedan disponibles.

---

## :material-wallet-outline: Paquete vigente

<div class="grid cards" markdown>

-   :material-package-variant-closed: **Paquete inicial**

    ---

    :material-wallet-outline: Horas contratadas: **a definir** (P-06)<br>
    :material-clock-check-outline: Consumido: **0 h**<br>
    :material-check-circle-outline: Saldo: **a definir**

    **Estado:** :material-circle:{ style="color: #94a3b8" } Pendiente de confirmación

</div>

---

## :material-calendar-month-outline: Reportes

Todavía no hay períodos reportados. El primer reporte se publica al cierre de la Versión 001.

---

## :material-information-outline: Cómo se reporta

<div class="grid cards" markdown>

-   :material-counter: **Por actividad**

    Cada hora se registra con su tipo: reunión, análisis, datos y migración, desarrollo, pruebas, capacitación o despliegue.

-   :material-link-variant: **Por requerimiento**

    Cada hora se asocia a un Issue de GitHub, para comparar lo estimado con lo consumido.

-   :material-email-outline: **Por email**

    Al cierre de cada versión se envía el reporte por email y se publica en esta sección.

-   :material-bell-alert-outline: **Con alerta**

    Cuando el saldo está por agotarse, se avisa por email para renovar o repriorizar.

</div>

### Qué tiene cada reporte

| Campo | Descripción |
|---|---|
| :material-wallet-outline: **Saldo inicial** | Horas disponibles al comenzar el período |
| :material-clock-check-outline: **Consumido** | Horas usadas, por tipo de actividad y por requerimiento |
| :material-scale-balance: **Estimado vs. real** | Diferencia entre el rango aprobado y lo consumido en cada requerimiento |
| :material-timer-sand: **Días de espera** | Días en que el trabajo esperó definiciones, documentación o validaciones de OSTEL |
| :material-check-circle-outline: **Saldo final** | Horas disponibles para el próximo período |

[:material-arrow-right: Ver reglas del paquete de horas](../methodology.md#paquete-de-horas){ .md-button }
