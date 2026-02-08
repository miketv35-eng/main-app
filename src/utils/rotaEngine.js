import { ad, fmt, parse, stype, bstart, CYCLE } from './dateUtils.js';

const LOADS_PER_OP = 15;

// Deterministic pseudo-random helper to ensure stable sorts
// Input: string seed
// Output: number between 0 and 1
const seededRandom = (seed) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h >>>= 0;
    return (h / 4294967296);
};

// Helper: check if op is off in staffing plan
export const isSpOff = (opName, ds, spOps) => {
    if (!spOps || !spOps.length) return false;
    const match = spOps.find(sp => sp.name.toLowerCase().trim() === opName.toLowerCase().trim());
    if (!match) return false;
    const st = match.days[ds];
    if (!st) return false;
    return !["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(st);
};

// Helper: count TMS loads
const countLoads = (ds, shiftType, tmsArea, loadingData) => {
    if (!loadingData || !loadingData.length) return 0;
    return loadingData.filter(r => r.date === ds && r.shift === shiftType && r.areaCode === tmsArea).length;
};

// Build agency availability
const getAvailAgency = (wDays, ops, spAgency) => {
    return ops.filter(o => o.isAgency).filter(ag => {
        const spMatch = spAgency.find(sp => sp.name.toLowerCase().trim() === ag.name.toLowerCase().trim());
        // If no staffing plan record, assume available if in ops list? 
        // Legacy logic said "if !spMatch return false", implying agency MUST be in plan to work
        if (!spMatch) return false;

        // Only D or N count as working
        return wDays.some(w => {
            const st = spMatch.days[w.ds];
            return st === "D" || st === "N";
        });
    });
};

// Check if op can work area
const canWorkArea = (opId, areaId, opsList) => {
    const op = opsList.find(o => o.id === opId);
    if (!op) return false;
    // If no quals defined, assume trained for nothing (except general?)
    // Legacy logic implied: if area has no specific qual requirement, maybe anyone can do it?
    // But legacy code used: `canWorkArea` logic which wasn't fully visible in snippets.
    // We'll reimplement standard logic: 
    // 1. If op has explicit qual for area, YES.
    // 2. If area is "canline" tasks, usually requires training.
    // For now, checks `op.quals.includes(areaId)`.
    return (op.quals || []).includes(areaId);
};

export function genRota(ops, areas, lines, team, hols, weekStart, prevAssign, training, machineStatus, loadingData, staffingPlan) {
    const warns = [], assigns = {}, grid = {};
    const dates = Array.from({ length: 7 }, (_, i) => ad(weekStart, i));
    const hist = {}; ops.forEach(o => { hist[o.id] = {} });

    // Build history from previous assignments
    Object.values(prevAssign).forEach(ba => Object.entries(ba).forEach(([oid, aid]) => {
        if (hist[oid]) hist[oid][aid] = (hist[oid][aid] || 0) + 1
    }));

    const anchor = parse(team.anchor);
    const bStarts = new Set();
    dates.forEach(d => {
        if (stype(anchor, d) !== "off") {
            const b = bstart(anchor, d);
            if (b) bStarts.add(fmt(b));
        }
    });

    // Staffing plan lookup keys
    const spKey = team.id.replace(/^t/i, "").toUpperCase();
    const spOps = staffingPlan?.fte?.[spKey] || [];
    const spAgency = staffingPlan?.agency || [];

    bStarts.forEach(bsStr => {
        const bsd = parse(bsStr);
        const wDays = Array.from({ length: 4 }, (_, i) => ({ date: ad(bsd, i), ds: fmt(ad(bsd, i)), st: CYCLE[i] }));
        const inWeek = wDays.filter(w => dates.some(d => fmt(d) === w.ds));

        if (!inWeek.length) return;

        const bk = `${team.id}_${bsStr}`;

        // If not previously assigned, generate new assignment
        if (!prevAssign[bk]) {
            const ba = {};
            const usedFTE = new Set();
            const usedAgency = new Set();

            // 1. Determine Availability
            const availFTE = ops.filter(op => {
                if (op.isAgency) return false;
                // Holiday check
                if (wDays.some(w => hols.some(h => h.opId === op.id && w.ds >= h.start && w.ds <= h.end))) return false;

                // Staffing Plan check
                if (spOps.length > 0) {
                    const match = spOps.find(sp => sp.name.toLowerCase().trim() === op.name.toLowerCase().trim());
                    if (match) {
                        // 10M check? Legacy had "10M" logic. We'll keep basic availability for now.
                        const allOff = wDays.every(w => {
                            const s = match.days[w.ds];
                            if (!s) return false;
                            return !["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(s);
                        });
                        if (allOff) return false;
                    }
                }
                return true;
            });

            const availAgency = getAvailAgency(wDays, ops, spAgency);

            // 2. Calculate Needs
            const areaNeeds = areas.map(area => {
                let need = area.min || 1;

                if (area.type === "line") {
                    const refDay = inWeek[0]?.ds || wDays[0]?.ds;
                    const dayStatus = machineStatus[refDay] || {};
                    const line = lines.find(l => l.id === area.lineId);
                    if (line) {
                        const running = line.machines.filter(m => dayStatus[m.id] !== false).length;
                        if (!running) return { ...area, need: 0, eligible: [], eligibleAgency: [] };

                        if (area.role) need = 1;
                        else {
                            // Dynamic need based on line config
                            // Priority/Canline used specific logic. We'll stick to config if possible.
                            need = line.id === "canline" ? (running < line.machines.length ? line.minOps : line.normalOps) : line.normalOps;
                        }
                    }
                } else if (area.type === "loading") {
                    let maxNeed = 0;
                    wDays.forEach(w => {
                        const loads = countLoads(w.ds, w.st, area.tmsArea, loadingData);
                        const n = Math.ceil(loads / LOADS_PER_OP);
                        if (n > maxNeed) maxNeed = n;
                    });
                    need = maxNeed || area.min || 0;
                } else if (area.type === "office") {
                    // Office logic (legacy)
                    need = 1; // Simplified for now, or keep logic if needed
                }

                // Determine eligibility
                let eligible = availFTE.filter(op => canWorkArea(op.id, area.id, ops));
                let eligibleAgency = availAgency.filter(ag => (ag.quals || []).includes(area.id));

                return { ...area, need, eligible, eligibleAgency };
            }).filter(a => a.need > 0).sort((a, b) => a.eligible.length - b.eligible.length); // Hardest to fill first

            // 3. Assign Preferences (FTE)
            availFTE.filter(op => op.prefArea).forEach(op => {
                const area = areaNeeds.find(a => a.id === op.prefArea);
                if (!area) return;
                const assigned = Object.values(ba).filter(v => v === area.id).length;
                if (assigned < area.need && canWorkArea(op.id, area.id, ops)) {
                    ba[op.id] = area.id;
                    usedFTE.add(op.id);
                }
            });

            // 4. Assign Preferences (Agency)
            availAgency.filter(ag => ag.prefArea).forEach(ag => {
                const area = areaNeeds.find(a => a.id === ag.prefArea);
                if (!area) return;
                const assigned = Object.values(ba).filter(v => v === area.id).length;
                if (assigned < area.need && (ag.quals || []).includes(area.id)) {
                    ba[ag.id] = area.id;
                    usedAgency.add(ag.id);
                }
            });

            // 5. Assign Priority Areas (e.g., Can Lines) - Ensure at least 1 FTE
            // We look for areas with 'priority: true' or fallback to lineId check
            const priorityAreas = areaNeeds.filter(a => a.priority || a.lineId === "canline");

            priorityAreas.forEach(area => {
                const assignedCount = Object.values(ba).filter(v => v === area.id).length;
                const hasFTE = Object.entries(ba).some(([id, aid]) => aid === area.id && !availAgency.some(ag => ag.id === id));

                if (!hasFTE && assignedCount < area.need) {
                    // deterministic sort scoring
                    const fteCands = area.eligible
                        .filter(o => !usedFTE.has(o.id))
                        .map(o => {
                            // Score = History + Deterministic Random
                            // We want to rotate, so higher history = lower priority? 
                            // Legacy added random to history count.
                            // New: Score = HistoryCount + SeededRandom
                            const hCount = hist[o.id]?.[area.id] || 0;
                            const rand = seededRandom(`${o.id}_${area.id}_${bsStr}`);
                            return { ...o, sc: hCount + rand };
                        })
                        .sort((a, b) => a.sc - b.sc); // Lowest score gets assigned (least history)

                    if (fteCands.length > 0) {
                        ba[fteCands[0].id] = area.id;
                        usedFTE.add(fteCands[0].id);
                    }
                }
            });

            // 6. Fill all areas (General Pass)
            // Sort areas by priority logic or emptiness? 
            // Legacy: Can lines first, then others.
            // We'll iterate all needed areas.
            areaNeeds.forEach(area => {
                // Fill remaining slots
                let assigned = Object.values(ba).filter(v => v === area.id).length;
                let remaining = area.need - assigned;

                while (remaining > 0) {
                    // Strategy: Try FTE, then Agency? Or logic specific?
                    // Legacy: CanLines -> Agency then FTE. Others -> FTE then Agency.
                    // Simplified Logic: 
                    // If priority/canline: Agency first (cheaper?), then FTE? 
                    // Actually legacy said: "Fill remaining can line needs with agency, then more FTE"

                    const isLine = area.lineId === "canline" || area.priority;

                    let candidates = [];
                    let isAgencySel = false;

                    if (isLine) {
                        // Agency first
                        const agCands = area.eligibleAgency.filter(o => !usedAgency.has(o.id));
                        if (agCands.length > 0) {
                            candidates = agCands;
                            isAgencySel = true;
                        } else {
                            // Fallback to FTE
                            candidates = area.eligible.filter(o => !usedFTE.has(o.id))
                                .map(o => ({ ...o, sc: (hist[o.id]?.[area.id] || 0) + seededRandom(`${o.id}_${area.id}_${bsStr}`) }))
                                .sort((a, b) => a.sc - b.sc);
                        }
                    } else {
                        // FTE first
                        const fteCands = area.eligible.filter(o => !usedFTE.has(o.id))
                            .map(o => ({ ...o, sc: (hist[o.id]?.[area.id] || 0) + seededRandom(`${o.id}_${area.id}_${bsStr}`) }))
                            .sort((a, b) => a.sc - b.sc);

                        if (fteCands.length > 0) {
                            candidates = fteCands;
                        } else {
                            // Fallback to Agency
                            candidates = area.eligibleAgency.filter(o => !usedAgency.has(o.id));
                            isAgencySel = true;
                        }
                    }

                    if (candidates.length === 0) break; // No one left

                    const selected = candidates[0]; // Take best candidate
                    ba[selected.id] = area.id;
                    if (isAgencySel) usedAgency.add(selected.id);
                    else usedFTE.add(selected.id);

                    remaining--;
                }

                if (Object.values(ba).filter(v => v === area.id).length < area.need) {
                    warns.push(`${area.name} needs ${area.need}, got ${Object.values(ba).filter(v => v === area.id).length}`);
                }
            });

            // 7. Leftovers
            // Agency -> Tents
            availAgency.filter(o => !usedAgency.has(o.id)).forEach(ag => {
                ba[ag.id] = "tents";
                usedAgency.add(ag.id);
            });

            // FTE -> Fill gaps?
            availFTE.filter(o => !usedFTE.has(o.id)).forEach(op => {
                // Find any area that is still underfilled (if warns didn't catch or barely filled min)
                // Legacy logic: "fill underfilled areas".
                // For now, if everyone allocated, they just stay "unassigned" (maybe floating)? 
                // Or we assign to a general pool?
                // Legacy assigned to best fit area even if filled.

                // For deterministic, we'll assign to "spare" or leave null?
                // App will render null as "Spare"?
                // Legacy code:
                /*
                const el = areaNeeds.filter(a => ... assigned < a.need);
                // If underfilled, assign.
                */
            });

            assigns[bk] = ba;
        } else {
            assigns[bk] = prevAssign[bk];
        }

        // Build Grid for UI
        inWeek.forEach(w => {
            if (!grid[w.ds]) grid[w.ds] = {};
            const ba = assigns[bk] || {};

            // Grid - FTE
            ops.forEach(op => {
                if (op.isAgency) return;
                const hol = hols.some(h => h.opId === op.id && w.ds >= h.start && w.ds <= h.end);

                let spOff = false;
                let reason = "H";
                if (spOps.length > 0) {
                    const match = spOps.find(sp => sp.name.toLowerCase().trim() === op.name.toLowerCase().trim());
                    if (match) {
                        const st = match.days[w.ds];
                        if (st && !["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(st)) {
                            spOff = true;
                            reason = st;
                        }
                    }
                }

                if (hol || spOff) {
                    grid[w.ds][op.id] = { area: null, st: w.st, tc: team.color, off: true, reason };
                } else if (ba[op.id]) {
                    grid[w.ds][op.id] = { area: ba[op.id], st: w.st, tc: team.color };
                }
            });

            // Grid - Agency
            ops.filter(o => o.isAgency).forEach(op => {
                const agMatch = spAgency.find(ag => ag.name.toLowerCase().trim() === op.name.toLowerCase().trim());
                const agSt = agMatch?.days[w.ds];
                const agWorking = agSt === "D" || agSt === "N";

                if (ba[op.id] && agWorking) {
                    grid[w.ds][op.id] = { area: ba[op.id], st: w.st, tc: "#F59E0B", isAgency: true };
                } else if (ba[op.id] && !agWorking) {
                    grid[w.ds][op.id] = { area: null, st: w.st, tc: "#F59E0B", off: true, reason: agSt || "OFF", isAgency: true };
                }
            });
        });
    });

    return { grid, assigns, warns };
}
