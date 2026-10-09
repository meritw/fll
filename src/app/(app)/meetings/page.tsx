import { redirect } from "next/navigation";

/** Meetings are started live from the journal now; keep old links working. */
export default function MeetingsRedirect() {
  redirect("/journal");
}
