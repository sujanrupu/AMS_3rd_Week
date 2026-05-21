import { useState } from "react";
import { apiRequest } from "../api/apiClient";

export default function MergeModal({
  targetKey,
  onClose,
  onMerge
}) {

  const [mode, setMode] = useState(
    "merge_into_this"
  );

  const [jiraId, setJiraId] =
    useState("");

  const [ticket, setTicket] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [merging, setMerging] =
    useState(false);


  // ─────────────────────────────
  // SEARCH
  // ─────────────────────────────
  const searchTicket = async () => {

    if (!jiraId.trim())
      return;

    setLoading(true);

    try {

      const res =
        await apiRequest(
          `/tickets/search/${jiraId.trim()}`
        );

      console.log(
        "search result:",
        res
      );

      if (
        res?.type === "error"
      ) {

        alert(
          "Ticket not found"
        );

        setTicket(null);

        return;
      }


      // only parent ticket allowed
      if (
        res.mode !==
        "parent-view"
      ) {

        alert(
          "Only parent tickets can be merged"
        );

        setTicket(null);

        return;
      }


      const found =
        res.parent;


      // prevent self merge
      if (
        found.issue_key
        === targetKey
      ) {

        alert(
          "Cannot merge same ticket"
        );

        setTicket(null);

        return;
      }

      setTicket(found);

    }
    catch (err) {

      console.log(
        "search error:",
        err
      );

      setTicket(null);
    }

    finally {

      setLoading(false);
    }
  };


  // ─────────────────────────────
  // MERGE
  // ─────────────────────────────
  const handleMerge =
    async () => {

    if (!ticket)
      return;

    try {

      setMerging(true);

      const payload = {

        mode,

        current_ticket:
          targetKey,

        selected_tickets: [

          ticket.issue_key
        ]
      };


      await onMerge(
        payload
      );


      onClose();

    }
    catch (err) {

      console.error(
        "merge error:",
        err
      );

      alert(
        "Merge failed"
      );
    }

    finally {

      setMerging(false);
    }
  };


  return (

<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

<div className="bg-surface border border-purple/20 rounded-2xl p-6 w-[550px]">

{/* HEADER */}

<div className="flex justify-between mb-5">

<div>

<h2 className="font-bold text-lg">
Merge Tickets
</h2>

<p className="text-xs text-muted">

Current:
{" "}
{targetKey}

</p>

</div>

<button
onClick={onClose}
className="text-xl text-muted"
>
✕
</button>

</div>



{/* MODE */}

<div className="space-y-2 mb-5">

<label
className="flex items-center gap-2 cursor-pointer"
>

<input
type="radio"
checked={
mode==="merge_into_this"
}
onChange={()=>{

setMode(
"merge_into_this"
);

setTicket(null);

}}
/>

<span>

Merge other tickets
into this

</span>

</label>


<label
className="flex items-center gap-2 cursor-pointer"
>

<input
type="radio"
checked={
mode==="merge_with_other"
}
onChange={()=>{

setMode(
"merge_with_other"
);

setTicket(null);

}}
/>

<span>

Merge this ticket
with another

</span>

</label>

</div>


{/* INPUT */}

<input
value={jiraId}
onChange={(e)=>{

setJiraId(
e.target.value.toUpperCase()
)

}}
onKeyDown={(e)=>{

if(
e.key==="Enter"
){

searchTicket();

}

}}
placeholder="Enter Parent Jira ID"
className="w-full px-3 py-3 rounded-xl bg-surface2 border border-purple/20 outline-none"
/>


<button
onClick={searchTicket}
className="w-full mt-3 bg-purple hover:bg-purpled text-black font-bold rounded-xl py-2"
>

{
loading
?
"Searching..."
:
"Search"
}

</button>



{/* RESULT */}

{
ticket && (

<div className="mt-5 border border-purple/20 rounded-xl p-4 space-y-3">

<div className="font-mono text-yellow font-bold">

{
ticket.issue_key
}

</div>


<div className="text-sm text-slate-300">

{
ticket.summary
}

</div>


<div className="text-xs text-muted">

Status:
{" "}
{
ticket.status
}

</div>


<button
onClick={handleMerge}
disabled={merging}
className={`w-full rounded-xl py-2 font-bold ${
merging
? "bg-gray-500 cursor-not-allowed"
: "bg-green/20 hover:bg-green/30"
}`}
>

{
merging
?
"Merging..."
:
"Confirm Merge"
}

</button>

</div>

)
}


<button
onClick={onClose}
className="w-full mt-4 bg-red-500/20 hover:bg-red-500/30 rounded-xl py-2"
>

Cancel

</button>

</div>

</div>

  );

}