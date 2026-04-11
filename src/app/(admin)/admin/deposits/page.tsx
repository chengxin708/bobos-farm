import { redirect } from 'next/navigation'

export default function DepositsPage() {
  redirect('/admin/reservations?view=deposits')
}
