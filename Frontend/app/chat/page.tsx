import { redirect } from 'next/navigation'

// Chat was replaced by the Notebook (and by using classmate inside Claude or ChatGPT). Old links land here.
export default function ChatPage() {
  redirect('/notebook')
}
