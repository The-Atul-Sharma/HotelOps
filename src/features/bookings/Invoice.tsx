import { forwardRef } from 'react';
import type { Booking, HotelSettings } from '@/types';
import { formatINR, formatDate, formatRoomTariffLabel } from '@/utils/format';
import { bookingRoomTotal, computeBookingBill, round2 } from '@/utils/finance';
import { groupExtraChargesForDisplay, formatGroupedExtraChargeLabel } from './bookingUtils';

export const Invoice = forwardRef<HTMLDivElement, { booking: Booking; settings: HotelSettings }>(
  function Invoice({ booking, settings }, ref) {
    const roomTotal = bookingRoomTotal(booking);
    const extraCharges = booking.extraCharges ?? [];
    const groupedExtras = groupExtraChargesForDisplay(extraCharges);
    const taxPercent =
      booking.taxPercent > 0 ? booking.taxPercent : settings.taxPercent || 0;
    const bill = computeBookingBill({
      roomAmount: roomTotal,
      extraCharges,
      foodAmount: booking.foodAmount,
      roomService: booking.roomService,
      discount: booking.discount,
      taxPercent,
      paidAmount: booking.paidAmount,
    });
    const { taxable, taxAmount, totalAmount: grandTotal } = bill;
    const cgst = round2(taxAmount / 2);
    const sgst = round2(taxAmount - cgst);
    const halfRate = round2(taxPercent / 2);

    return (
      <div ref={ref} className="bg-white p-8 text-black">
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <h1 className="text-2xl font-bold">{settings.hotelName}</h1>
            <p className="text-sm">{settings.address}</p>
            <p className="text-sm">Phone: {settings.phone}</p>
            {settings.gstNumber && <p className="text-sm">GSTIN: {settings.gstNumber}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">INVOICE</h2>
            <p className="text-sm">No: INV-{booking.code}</p>
            <p className="text-sm">Date: {formatDate(new Date())}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold">Bill To</p>
            <p>{booking.guestName}</p>
            {booking.mobile && booking.mobile !== '—' && <p>{booking.mobile}</p>}
            {booking.email && <p>{booking.email}</p>}
          </div>
          <div className="text-right">
            <p>
              Room: {booking.roomNumber} ({booking.roomType})
            </p>
            <p>Check-in: {formatDate(booking.checkInDate)}</p>
            <p>Check-out: {formatDate(booking.checkOutDate)}</p>
            <p>Guests: {booking.adults + booking.children}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-y border-black">
              <th className="py-2 text-left">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="py-1.5">
                {formatRoomTariffLabel(booking)} · Room {booking.roomNumber}
              </td>
              <td className="py-1.5 text-right">{formatINR(roomTotal)}</td>
            </tr>
            {booking.discount > 0 && (
              <tr className="border-b border-gray-300">
                <td className="py-1.5">Discount</td>
                <td className="py-1.5 text-right">-{formatINR(booking.discount)}</td>
              </tr>
            )}
            {taxPercent > 0 && (
              <>
                <tr className="border-b border-gray-300">
                  <td className="py-1.5">CGST @ {halfRate}%</td>
                  <td className="py-1.5 text-right">{formatINR(cgst)}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="py-1.5">SGST @ {halfRate}%</td>
                  <td className="py-1.5 text-right">{formatINR(sgst)}</td>
                </tr>
              </>
            )}
            {booking.foodAmount > 0 && (
              <tr className="border-b border-gray-300">
                <td className="py-1.5">Food</td>
                <td className="py-1.5 text-right">{formatINR(booking.foodAmount)}</td>
              </tr>
            )}
            {booking.roomService > 0 && (
              <tr className="border-b border-gray-300">
                <td className="py-1.5">Room Service</td>
                <td className="py-1.5 text-right">{formatINR(booking.roomService)}</td>
              </tr>
            )}
            {groupedExtras.map((g) => (
              <tr key={g.key} className="border-b border-gray-300">
                <td className="py-1.5">
                  {formatGroupedExtraChargeLabel(g)}
                  {g.quantity > 1 && (
                    <span className="text-gray-600"> @ {formatINR(g.unitPrice)}</span>
                  )}
                </td>
                <td className="py-1.5 text-right">{formatINR(g.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-y-2 border-black font-bold">
              <td className="py-2">Grand Total</td>
              <td className="py-2 text-right">{formatINR(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {(taxPercent > 0 || extraCharges.length > 0) && (
          <p className="mt-3 text-xs text-gray-600">
            {taxPercent > 0 && (
              <>
                GST @ {taxPercent}% included in room tariff · Taxable {formatINR(taxable)} · Tax{' '}
                {formatINR(taxAmount)}
              </>
            )}
            {taxPercent > 0 && extraCharges.length > 0 && ' · '}
            {extraCharges.length > 0 && 'Extra charges are not subject to GST'}
          </p>
        )}

        <p className="mt-10 text-center text-sm text-gray-600">Thank you for staying with us.</p>
      </div>
    );
  },
);
