import * as XLSX from 'xlsx';

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportarFilasAJson(filas, nombreArchivo = 'vecinos-respaldo.json') {
  const contenido = JSON.stringify(filas, null, 2);
  const blob = new Blob([contenido], { type: 'application/json;charset=utf-8' });
  descargarBlob(blob, nombreArchivo);
}

export function exportarFilasAExcel(filas, nombreArchivo = 'vecinos-exportados.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vecinos');

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array'
  });

  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  descargarBlob(blob, nombreArchivo);
}
