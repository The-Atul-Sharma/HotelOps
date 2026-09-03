import { FileSpreadsheet, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/utils/excel';
import { printPage } from '@/utils/print';

type Props = {
  rows: Record<string, unknown>[];
  filename: string;
};

export function ExportPrintActions({ rows, filename }: Props) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 no-print"
        onClick={() => exportToExcel(rows, filename)}
      >
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 no-print" onClick={printPage}>
        <Printer className="h-4 w-4" /> Print
      </Button>
    </>
  );
}
