import React, { useRef } from 'react';
import { 
  FileText, 
  Printer, 
  X, 
  Building2, 
  CheckCircle2, 
  ShieldCheck, 
  Download,
  Calendar,
  UserCheck
} from 'lucide-react';
import { Loan, Asset, UserProfile } from '../../types';
import { formatDateTime, formatDate } from '../../services/gabahService';

interface BastDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan?: Loan | null;
  asset?: Asset | null;
  assignedUser?: UserProfile | null;
  currentUser?: UserProfile | null;
}

export const BastDocumentModal: React.FC<BastDocumentModalProps> = ({
  isOpen,
  onClose,
  loan,
  asset,
  assignedUser,
  currentUser,
}) => {
  const printRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;
  if (!loan && !asset) return null;

  const isAssignmentMode = !loan && Boolean(asset);

  // Recipient details
  const recipientName = isAssignmentMode 
    ? (assignedUser?.name || asset?.assigned_to?.name || 'Karyawan Penerima') 
    : loan!.borrower_name;
  const recipientDepartment = isAssignmentMode 
    ? (assignedUser?.department || asset?.assigned_to?.department || 'Divisi Terkait') 
    : loan!.borrower_department;
  const recipientPhone = isAssignmentMode 
    ? (assignedUser?.phone || '-') 
    : (loan!.borrower_phone || '-');
  const purposeText = isAssignmentMode 
    ? 'Penugasan Inventaris Kerja Tetap (Operasional Kedinasan Pegawai)' 
    : loan!.purpose;

  // Giver / Approver details
  const giverName = isAssignmentMode
    ? (currentUser?.name || 'Tim Pengelola Aset (IT Admin)')
    : (loan!.approver_name || 'Tim Pengelola Aset (GA / IT Admin)');
  const giverDivision = isAssignmentMode
    ? (asset?.owner_division === 'IT' ? 'Divisi Teknologi Informasi' : 'Divisi Umum & Rumah Tangga (GA)')
    : (loan!.category_type === 'IT' ? 'Divisi Teknologi Informasi' : 'Divisi Umum & Rumah Tangga (GA)');

  const bastNumber = isAssignmentMode
    ? `BAST/ASSIGN/${asset?.owner_division || 'IT'}/${new Date().getFullYear()}/${(asset?.asset_number || 'AST-001').replace(/[^a-zA-Z0-9]/g, '')}`
    : `BAST/${loan!.category_type}/${new Date().getFullYear()}/${loan!.loan_number.replace('LOAN-', '')}`;

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const assetName = isAssignmentMode ? asset!.name : loan!.asset_name;
  const assetNumber = isAssignmentMode ? asset!.asset_number : loan!.asset_number;
  const corporateNumber = isAssignmentMode ? asset!.corporate_asset_number : loan!.corporate_asset_number;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  {isAssignmentMode ? 'BAST Penugasan Aset Inventaris' : 'Berita Acara Serah Terima (BAST)'}
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Dokumen Resmi BUMD
                </span>
              </div>
              <p className="text-xs text-slate-500">Nomor Registrasi Dokumen: {bastNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="w-4 h-4" />
              Cetak / Unduh PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Body (Printable Paper Sheet) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
          <div 
            ref={printRef}
            className="w-full max-w-[210mm] bg-white text-slate-900 p-8 sm:p-12 shadow-2xl rounded-sm border border-slate-300 font-serif leading-relaxed text-sm space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none"
            style={{ minHeight: '297mm', color: '#111827' }}
          >
            {/* Kop Surat Resmi BUMD */}
            <div className="border-b-4 border-double border-slate-900 pb-4 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Building2 className="w-7 h-7 text-emerald-800" />
                <h1 className="font-sans text-lg font-black tracking-wider uppercase">
                  PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA
                </h1>
              </div>
              <h2 className="font-sans text-base font-bold tracking-normal uppercase">
                PT FOOD STATION TJIPINANG JAYA (PERSERODA)
              </h2>
              <p className="font-sans text-xs text-slate-600">
                Divisi Umum, Logistik &amp; Teknologi Informasi (Portal GABAH)
              </p>
              <p className="font-sans text-[11px] text-slate-500 italic">
                Komp. Pasar Induk Beras Cipinang, Jl. Pisangan Timur No. 1, Jakarta Timur 13230 • Telp: (021) 4786-8888 • helpdesk@foodstation.co.id
              </p>
            </div>

            {/* Judul & Nomor BAST */}
            <div className="text-center space-y-1 pt-2">
              <h3 className="text-base font-bold underline uppercase tracking-wide">
                {isAssignmentMode 
                  ? 'BERITA ACARA SERAH TERIMA PENUGASAN BARANG INVENTARIS'
                  : 'BERITA ACARA SERAH TERIMA PINJAM PAKAI BARANG INVENTARIS'}
              </h3>
              <p className="font-mono text-xs font-semibold text-slate-700">
                Nomor: {bastNumber}
              </p>
            </div>

            {/* Pembuka */}
            <p className="text-justify text-xs leading-relaxed">
              Pada hari ini, <strong>{todayFormatted}</strong>, bertempat di Kantor Pusat PT Food Station Tjipinang Jaya (Perseroda), Komp. Pasar Induk Beras Cipinang Jakarta Timur, kami yang bertanda tangan di bawah ini:
            </p>

            {/* Pihak Pertama & Kedua */}
            <div className="space-y-3 text-xs">
              <div className="pl-4 border-l-2 border-slate-400 space-y-1">
                <div className="font-bold">I. PIHAK PERTAMA (Yang Menyerahkan):</div>
                <div className="grid grid-cols-4 gap-1">
                  <span className="text-slate-600">Nama Petugas</span>
                  <span className="col-span-3">: {giverName}</span>
                  <span className="text-slate-600">Jabatan</span>
                  <span className="col-span-3">: Staf Pengelola Aset & Inventaris Korporat</span>
                  <span className="text-slate-600">Divisi</span>
                  <span className="col-span-3">: {giverDivision}</span>
                </div>
              </div>

              <div className="pl-4 border-l-2 border-slate-400 space-y-1">
                <div className="font-bold">II. PIHAK KEDUA (Yang Menerima / Pemegang Aset):</div>
                <div className="grid grid-cols-4 gap-1">
                  <span className="text-slate-600">Nama Karyawan</span>
                  <span className="col-span-3 font-semibold">: {recipientName}</span>
                  <span className="text-slate-600">Departemen</span>
                  <span className="col-span-3">: {recipientDepartment}</span>
                  <span className="text-slate-600">No. Kontak / HP</span>
                  <span className="col-span-3">: {recipientPhone}</span>
                  <span className="text-slate-600">Tujuan Penggunaan</span>
                  <span className="col-span-3">: {purposeText}</span>
                </div>
              </div>
            </div>

            <p className="text-justify text-xs leading-relaxed">
              PIHAK PERTAMA telah menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah menerima dalam keadaan baik, lengkap, dan berfungsi normal barang inventaris milik perusahaan dengan rincian sebagai berikut:
            </p>

            {/* Tabel Spesifikasi Aset */}
            <table className="w-full text-left text-xs border-collapse border border-slate-400 font-sans">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-400 p-2 text-center w-10">No</th>
                  <th className="border border-slate-400 p-2">Rincian Barang & Spesifikasi</th>
                  <th className="border border-slate-400 p-2">Nomor Identitas Aset</th>
                  <th className="border border-slate-400 p-2 text-center w-24">Kondisi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-2.5 text-center font-bold">1</td>
                  <td className="border border-slate-400 p-2.5 space-y-1">
                    <div className="font-bold text-sm text-slate-900">{assetName}</div>
                    <div className="text-[11px] text-slate-600">
                      Merk/Model: {asset?.brand || 'Standard'} {asset?.model || ''}
                    </div>
                    {asset?.specifications && (
                      <div className="text-[10px] text-slate-500 italic">
                        Spek: {asset.specifications}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-400 p-2.5 font-mono text-[11px] space-y-1">
                    <div>Asset No: <strong>{assetNumber}</strong></div>
                    <div>SN: {asset?.serial_number || '-'}</div>
                    {corporateNumber && (
                      <div>Corp ID: {corporateNumber}</div>
                    )}
                  </td>
                  <td className="border border-slate-400 p-2.5 text-center font-bold text-emerald-700">
                    {asset?.condition ? asset.condition.toUpperCase() : 'BAIK (NORMAL)'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Status / Jadwal */}
            <div className="p-3 bg-slate-50 border border-slate-300 rounded font-sans text-xs space-y-1">
              <div className="font-bold text-slate-800">
                {isAssignmentMode ? 'Status & Penempatan Penugasan:' : 'Masa Berlaku Peminjaman:'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <div>Tanggal Serah Terima: <strong>{isAssignmentMode ? todayFormatted : formatDateTime(loan!.start_date)}</strong></div>
                <div>
                  {isAssignmentMode ? (
                    <span>Status: <strong className="text-emerald-700">Inventaris Kerja Pegawai (Aktif)</strong></span>
                  ) : (
                    <span>Batas Akhir Pengembalian: <strong className="text-rose-700">{formatDateTime(loan!.due_date)}</strong></span>
                  )}
                </div>
              </div>
            </div>

            {/* Klausul Ketentuan & Tanggung Jawab */}
            <div className="space-y-1 text-[11px] text-slate-700 leading-normal">
              <div className="font-bold font-sans text-slate-900 text-xs">KETENTUAN DAN TANGGUNG JAWAB:</div>
              <ol className="list-decimal pl-4 space-y-1 text-justify">
                <li>PIHAK KEDUA berkewajiban merawat, menjaga keamanan, dan menggunakan aset tersebut semata-mata untuk kepentingan kedinasan/operasional perusahaan.</li>
                <li>Dilarang keras meminjamkan kembali, menyewakan, atau memindahtangankan aset kepada pihak ketiga tanpa izin tertulis dari Tim Pengelola Aset (IT/GA).</li>
                <li>Segala bentuk kerusakan atau kehilangan akibat kelalaian pemakaian menjadi tanggung jawab sepenuhnya PIHAK KEDUA sesuai dengan Peraturan Disiplin dan SOP Aset Perusahaan.</li>
                {isAssignmentMode ? (
                  <li>Apabila terjadi mutasi, rotasi jabatan, atau pengunduran diri (resign), PIHAK KEDUA wajib mengembalikan aset ini dalam keadaan baik dan lengkap kepada Divisi Pengelola Aset.</li>
                ) : (
                  <li>Barang harus dikembalikan tepat waktu pada tanggal yang telah ditetapkan dalam kondisi utuh beserta seluruh kelengkapannya.</li>
                )}
              </ol>
            </div>

            {/* Kolom Tanda Tangan 3 Pihak */}
            <div className="pt-4 font-sans text-xs">
              <div className="grid grid-cols-3 text-center gap-4">
                
                {/* Pihak Pertama */}
                <div className="space-y-16">
                  <div>
                    <div className="font-semibold">PIHAK PERTAMA</div>
                    <div className="text-[10px] text-slate-500">Yang Menyerahkan</div>
                  </div>
                  <div>
                    <div className="font-bold underline">{giverName}</div>
                    <div className="text-[10px] text-slate-500">{giverDivision}</div>
                  </div>
                </div>

                {/* Pihak Kedua */}
                <div className="space-y-16">
                  <div>
                    <div className="font-semibold">PIHAK KEDUA</div>
                    <div className="text-[10px] text-slate-500">Yang Menerima / Pemegang Aset</div>
                  </div>
                  <div>
                    <div className="font-bold underline">{recipientName}</div>
                    <div className="text-[10px] text-slate-500">{recipientDepartment}</div>
                  </div>
                </div>

                {/* Mengetahui */}
                <div className="space-y-16">
                  <div>
                    <div className="font-semibold">MENGETAHUI</div>
                    <div className="text-[10px] text-slate-500">Kepala Bagian Umum & IT</div>
                  </div>
                  <div>
                    <div className="font-bold underline">H. Ir. Bambang Sujarwo, M.M.</div>
                    <div className="text-[10px] text-slate-500">NPP: 2015-DIR-002</div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer QR Verification */}
            <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-sans">
              <span>Dokumen ini sah dicetak dari Portal GABAH (General Asset &amp; Business Automated Helpdesk)</span>
              <span>Kode Verifikasi: {isAssignmentMode ? assetNumber : loan!.loan_number}</span>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between print:hidden">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Siap Dicetak ke Kertas A4 Standar
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
