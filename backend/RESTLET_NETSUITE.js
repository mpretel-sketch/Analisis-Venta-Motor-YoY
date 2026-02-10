/**
 * RESTLET DE NETSUITE PARA ANÁLISIS YOY
 *
 * Este RESTlet debe ser desplegado en NetSuite para proporcionar datos de ventas
 * en el formato esperado por el backend de análisis.
 *
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. En NetSuite, ve a Customization > Scripting > Scripts > New
 * 2. Selecciona "RESTlet" como tipo de script
 * 3. Copia este código en el editor
 * 4. Configura las funciones:
 *    - GET Function: getVentasYoY
 * 5. Despliega el script y anota la URL generada
 * 6. Configura la URL en tu archivo .env como NS_RESTLET_URL
 *
 * ESTRUCTURA DE RESPUESTA:
 * [
 *   {
 *     "Cliente": "Hotel ABC S.L.",
 *     "Hotel - Code": "ABC001",
 *     "Ubicación": "Barcelona",
 *     "ene 2023": 10000.50,
 *     "feb 2023": 12000.75,
 *     "mar 2023": 15000.00,
 *     ... (todos los meses disponibles)
 *   },
 *   ...
 * ]
 */

/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/search', 'N/record', 'N/format'], function(search, record, format) {

    /**
     * Función GET del RESTlet
     * Parámetros opcionales:
     * - startDate: Fecha inicio (formato YYYY-MM-DD)
     * - endDate: Fecha fin (formato YYYY-MM-DD)
     */
    function getVentasYoY(requestParams) {
        try {
            log.audit({
                title: 'Inicio RESTlet Ventas YoY',
                details: 'Parámetros recibidos: ' + JSON.stringify(requestParams)
            });

            // Parsear parámetros
            var startDate = requestParams.startDate || null;
            var endDate = requestParams.endDate || null;

            // OPCIÓN 1: Usar un Saved Search existente
            // Reemplaza 'customsearch_ventas_yoy' con el ID de tu Saved Search
            var savedSearchId = 'customsearch_ventas_yoy'; // O usa el ID numérico: '123'

            // Si no tienes un Saved Search, comenta la línea anterior y usa la OPCIÓN 2 abajo

            var salesData = {};
            var months = new Set();

            try {
                // Intentar cargar el Saved Search
                var mySearch = search.load({
                    id: savedSearchId
                });

                // Aplicar filtros de fecha si se proporcionan
                if (startDate || endDate) {
                    var filters = mySearch.filters;
                    if (startDate) {
                        filters.push(search.createFilter({
                            name: 'trandate',
                            operator: search.Operator.ONORAFTER,
                            values: startDate
                        }));
                    }
                    if (endDate) {
                        filters.push(search.createFilter({
                            name: 'trandate',
                            operator: search.Operator.ONORBEFORE,
                            values: endDate
                        }));
                    }
                    mySearch.filters = filters;
                }

                // Ejecutar búsqueda
                mySearch.run().each(function(result) {
                    // Ajusta estos nombres de columna según tu Saved Search
                    var cliente = result.getValue({ name: 'companyname' }) || result.getValue({ name: 'customer' }) || '';
                    var hotelCode = result.getValue({ name: 'custentity_hotel_code' }) || ''; // Campo personalizado
                    var ubicacion = result.getValue({ name: 'custentity_ubicacion' }) || ''; // Campo personalizado
                    var mes = result.getValue({ name: 'trandate', summary: 'GROUP' }); // Mes de la transacción
                    var importe = parseFloat(result.getValue({ name: 'amount', summary: 'SUM' }) || 0);

                    // Crear key única por cliente
                    var key = cliente;

                    if (!salesData[key]) {
                        salesData[key] = {
                            'Cliente': cliente,
                            'Hotel - Code': hotelCode,
                            'Ubicación': ubicacion
                        };
                    }

                    // Formatear mes (ej: "ene 2024")
                    var monthLabel = formatMonthLabel(mes);
                    months.add(monthLabel);

                    // Agregar importe al mes correspondiente
                    if (!salesData[key][monthLabel]) {
                        salesData[key][monthLabel] = 0;
                    }
                    salesData[key][monthLabel] += importe;

                    return true; // Continuar iteración
                });

            } catch (e) {
                // Si el Saved Search no existe, usar OPCIÓN 2
                log.error({
                    title: 'Saved Search no encontrado',
                    details: 'Usando consulta directa. Error: ' + e.message
                });

                // OPCIÓN 2: Crear búsqueda dinámica
                // Ajusta según tu estructura de NetSuite
                var transactionSearch = search.create({
                    type: search.Type.TRANSACTION,
                    filters: [
                        ['type', 'anyof', 'CustInvc'], // Facturas de cliente
                        'AND',
                        ['mainline', 'is', 'T'], // Solo líneas principales
                        'AND',
                        ['status', 'anyof', 'CustInvc:A'], // Aprobadas
                    ],
                    columns: [
                        search.createColumn({ name: 'companyname', summary: 'GROUP' }),
                        search.createColumn({ name: 'custentity_hotel_code', join: 'customer', summary: 'MAX' }),
                        search.createColumn({ name: 'custentity_ubicacion', join: 'customer', summary: 'MAX' }),
                        search.createColumn({
                            name: 'trandate',
                            summary: 'GROUP',
                            formula: "TO_CHAR({trandate}, 'Mon YYYY')" // Formato: "Jan 2024"
                        }),
                        search.createColumn({ name: 'amount', summary: 'SUM' })
                    ]
                });

                // Aplicar filtros de fecha
                if (startDate || endDate) {
                    var filters = transactionSearch.filters;
                    if (startDate) {
                        filters.push(['AND', ['trandate', 'onorafter', startDate]]);
                    }
                    if (endDate) {
                        filters.push(['AND', ['trandate', 'onorbefore', endDate]]);
                    }
                }

                transactionSearch.run().each(function(result) {
                    var cliente = result.getValue({ name: 'companyname', summary: 'GROUP' }) || '';
                    var hotelCode = result.getValue({ name: 'custentity_hotel_code', join: 'customer', summary: 'MAX' }) || '';
                    var ubicacion = result.getValue({ name: 'custentity_ubicacion', join: 'customer', summary: 'MAX' }) || '';
                    var mes = result.getValue({ name: 'trandate', summary: 'GROUP' });
                    var importe = parseFloat(result.getValue({ name: 'amount', summary: 'SUM' }) || 0);

                    var key = cliente;

                    if (!salesData[key]) {
                        salesData[key] = {
                            'Cliente': cliente,
                            'Hotel - Code': hotelCode,
                            'Ubicación': ubicacion
                        };
                    }

                    var monthLabel = formatMonthLabel(mes);
                    months.add(monthLabel);

                    if (!salesData[key][monthLabel]) {
                        salesData[key][monthLabel] = 0;
                    }
                    salesData[key][monthLabel] += importe;

                    return true;
                });
            }

            // Convertir a array y asegurar que todos los meses están presentes
            var result = [];
            var monthsArray = Array.from(months).sort();

            for (var key in salesData) {
                var row = salesData[key];
                // Rellenar meses faltantes con 0
                monthsArray.forEach(function(month) {
                    if (!(month in row)) {
                        row[month] = 0;
                    }
                });
                result.push(row);
            }

            log.audit({
                title: 'Resultado RESTlet',
                details: 'Total registros: ' + result.length + ', Meses: ' + monthsArray.length
            });

            return result;

        } catch (e) {
            log.error({
                title: 'Error en RESTlet',
                details: e.message + '\nStack: ' + e.stack
            });

            return {
                error: true,
                message: e.message,
                stack: e.stack
            };
        }
    }

    /**
     * Formatea la fecha a formato español: "ene 2024", "feb 2024", etc.
     */
    function formatMonthLabel(dateString) {
        // Si viene como "Jan 2024", convertir a "ene 2024"
        var monthMap = {
            'Jan': 'ene', 'Feb': 'feb', 'Mar': 'mar', 'Apr': 'abr',
            'May': 'may', 'Jun': 'jun', 'Jul': 'jul', 'Aug': 'ago',
            'Sep': 'sep', 'Oct': 'oct', 'Nov': 'nov', 'Dec': 'dic',
            // También en español por si acaso
            'Ene': 'ene', 'Abr': 'abr', 'Ago': 'ago', 'Dic': 'dic'
        };

        try {
            var parts = dateString.split(' ');
            if (parts.length >= 2) {
                var month = monthMap[parts[0]] || parts[0].toLowerCase().substring(0, 3);
                var year = parts[1];
                return month + ' ' + year;
            }

            // Si es un objeto Date de NetSuite
            if (typeof dateString === 'object') {
                var month = dateString.getMonth() + 1;
                var year = dateString.getFullYear();
                var monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                                'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                return monthNames[month - 1] + ' ' + year;
            }

            return dateString;
        } catch (e) {
            log.error('Error formateando mes', e.message);
            return dateString;
        }
    }

    return {
        get: getVentasYoY
    };
});
