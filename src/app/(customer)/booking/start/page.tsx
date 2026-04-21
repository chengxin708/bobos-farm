import { redirect } from "next/navigation"

// /booking/start previously showed a dual-card choice ("book" vs "inquire").
// The flow is now unified: everyone enters at /booking/date and mid-flow
// detection routes uncertain selections to the inquiry form. This stub is
// kept only so any stale bookmarks or external links still land correctly.
export default function BookingStartRedirect() {
  redirect("/booking/date")
}
