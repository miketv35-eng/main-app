import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://nuxntitedixiijtxzuni.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eG50aXRlZGl4aWlqdHh6dW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTQzMjQsImV4cCI6MjA4NTk3MDMyNH0.Wpzpo2_KE07S7xe7SEQQsaRTff6YAAJeiMDz1JRJaak";
const supabase = createClient(SUPA_URL, SUPA_KEY);

const SHIFT_OPS = {
    tA: [
        { id: "op1", name: "Paul Williams" }, { id: "op2", name: "Anthony Johnston" }, { id: "op3", name: "Szymon Chowanski" },
        { id: "op4", name: "Shaun Dorrington" }, { id: "op5", name: "Brian Jones" }, { id: "op6", name: "Chris Fullick" },
        { id: "op7", name: "Martin Hegarty" }, { id: "op8", name: "Robert Stallard" }, { id: "op9", name: "Chris Guscott" },
        { id: "op10", name: "Mark Watkins" }, { id: "op11", name: "Russell Jones" }, { id: "op12", name: "William John" },
        { id: "op13", name: "Tom Rosser" }, { id: "op14", name: "James Fagan" }, { id: "op15", name: "Ian Hennessy" },
        { id: "op16", name: "Andy Child" }, { id: "op17", name: "Karl Lewis" },
    ],
    tB: [
        { id: "bop1", name: "Richard Green" }, { id: "bop2", name: "Scott Jarvis" }, { id: "bop3", name: "Craig Jones" },
        { id: "bop4", name: "Ryan Green" }, { id: "bop5", name: "Mark Williams" }, { id: "bop6", name: "Jon Sutton" },
        { id: "bop7", name: "Colin Scott" }, { id: "bop8", name: "James Francis" }, { id: "bop9", name: "Lewis Kendall" },
        { id: "bop10", name: "Matt Jarvis" }, { id: "bop11", name: "Martin White" }, { id: "bop12", name: "Phil Upton" },
        { id: "bop13", name: "Lee Williams" }, { id: "bop14", name: "Callum Vaughan" }, { id: "bop15", name: "Matt Byard" },
        { id: "bop16", name: "Peter Mako" }, { id: "bop17", name: "Ben Fowler" }, { id: "bop18", name: "Richard Dodds" },
    ],
    tC: [
        { id: "cop1", name: "Gavin Jones" }, { id: "cop2", name: "Mark Davies" }, { id: "cop3", name: "Luke Hale" },
        { id: "cop4", name: "Taylor Mansell" }, { id: "cop5", name: "Anthony Jamieson" }, { id: "cop6", name: "Mark Worsfold" },
        { id: "cop7", name: "Gareth Butcher" }, { id: "cop8", name: "Lee Ford" }, { id: "cop9", name: "Darren Jones" },
        { id: "cop10", name: "Karl Mansell" }, { id: "cop11", name: "Will Bain" }, { id: "cop12", name: "Stuart George" },
        { id: "cop13", name: "Craig Larcombe" }, { id: "cop14", name: "James Morris" }, { id: "cop15", name: "Dan Antell" },
        { id: "cop16", name: "Julian Edwards" }, { id: "cop17", name: "Mark Watkins" }, { id: "cop18", name: "Evan Young" },
        { id: "cop19", name: "Ethan Hooper" },
    ],
    tD: [
        { id: "dop1", name: "Michael Rowlands" }, { id: "dop2", name: "Kevin Davies" }, { id: "dop3", name: "Dorian Neale" },
        { id: "dop4", name: "Jamie Edgel" }, { id: "dop5", name: "Norbert Karoly" }, { id: "dop6", name: "Matthew Thomas" },
        { id: "dop7", name: "Phil Jones" }, { id: "dop8", name: "Jason Bourne" }, { id: "dop9", name: "Andrew Gripton" },
        { id: "dop10", name: "Andrew Lewis" }, { id: "dop11", name: "Paul Wilson" }, { id: "dop12", name: "Gareth Otterwell" },
        { id: "dop13", name: "Carl Inker" }, { id: "dop14", name: "Tony Hunt" }, { id: "dop15", name: "Matt Hayes" },
        { id: "dop16", name: "Steve Pope" }, { id: "dop17", name: "Ewan Long" }, { id: "dop18", name: "Craig Butler" },
    ],
};

async function seed() {
    console.log("Seeding Operators...");

    const allOps = [];
    for (const [shiftId, ops] of Object.entries(SHIFT_OPS)) {
        ops.forEach(op => {
            allOps.push({
                id: op.id,
                name: op.name,
                shift_id: shiftId,
                qualifications: ["canline", "botline"], // Default quals for now
                is_agency: false
            });
        });
    }

    const { error } = await supabase.from("operators").upsert(allOps);

    if (error) {
        console.error("Seed Failed:", error);
    } else {
        console.log(`Successfully seeded ${allOps.length} operators.`);
    }
}

seed();
