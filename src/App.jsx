import React, { useState, useCallback, useMemo, useEffect, Fragment } from "react";
import * as XLSX from "xlsx";
import { saveSicknessRecords, getDepartmentSicknessRate, saveStaffingPlan, getShiftSicknessOverview, updateOperatorStartDate } from './utils/supabaseClient';

const API_URL = "/api/claude";

/* ═══════════════════════════════════════════════════
   CONSTANTS & UTILITIES
   ═══════════════════════════════════════════════════ */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
};

const CYCLE = ["day", "day", "night", "night", "off", "off", "off", "off"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOADS_PER_OP = 15;
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) };
const ad = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r };
const df = (a, b) => Math.round((b - a) / 864e5);
const ws = d => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0, 0, 0, 0); return r };
const wl = d => { const s = ws(d), e = ad(s, 6); return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` };
const cd = (a, t) => ((df(a, t) % 8) + 8) % 8;
const stype = (a, t) => CYCLE[cd(a, t)];
const bstart = (a, d) => { const c = cd(a, d); return c < 4 ? ad(d, -c) : null };

/* ═══════════════════════════════════════════════════
   SKAP TASKS (131 tasks, 6 modules) — SHARED
   ═══════════════════════════════════════════════════ */
const SKAP_MODULES = [
  { id: "L1", name: "New Starter", level: 1, color: "#64748B" },
  { id: "L2", name: "Beginner", level: 2, color: "#3B82F6" },
  { id: "L3", name: "Intermediate", level: 3, color: "#10B981" },
  { id: "L4", name: "Advanced", level: 4, color: "#F59E0B" },
  { id: "L5", name: "Advanced Plus", level: 5, color: "#EF4444" },
  { id: "L6", name: "MOP", level: 6, color: "#A855F7" },
];
const SKAP_TASKS = [
  { id: "L1-001", mod: "L1", name: "Complete the FLT induction assessment and on-boarding", area: null },
  { id: "L1-002", mod: "L1", name: "Knows and understand safety procedure around FLT", area: null },
  { id: "L1-003", mod: "L1", name: "Completes pre-assessment questionnaire & assessment by an RTITB instructor", area: null },
  { id: "L1-004", mod: "L1", name: "Passed both the FLT theory test & practical test and undertake/pass the annual refresher", area: null },
  { id: "L1-005", mod: "L1", name: "Knows and understands the FLT checklist process & FLT LPG gas refuelling", area: null },
  { id: "L1-006", mod: "L1", name: "Knows and understands basic warehouse layout and traffic plan", area: "loading" },
  { id: "L1-007", mod: "L1", name: "Knows and understands safe stacking techniques and use of ASRS", area: "loading" },
  { id: "L1-008", mod: "L1", name: "Understand and has basic operational understanding of WMS terminals and IT introduction", area: null },
  { id: "L1-009", mod: "L1", name: "Understand the PPE requirements for all logistics areas", area: null },
  { id: "L1-010", mod: "L1", name: "Understand the Logistics Highway Code – local operating Code of Practice", area: null },
  { id: "L1-011", mod: "L1", name: "Understand the risks associated with the storage and handling of chemical substances", area: null },
  { id: "L1-012", mod: "L1", name: "Understand the operational controls & emergency response procedures regarding fire evacuation", area: null },
  { id: "L1-013", mod: "L1", name: "Understand and apply the Incident/accident procedure and reporting in Logistics", area: null },
  { id: "L1-014", mod: "L1", name: "Understands ABI SAFE and general Safety on 3 levels", area: null },
  { id: "L1-015", mod: "L1", name: "Understand the process of SAFE and how it applies to day to day operation in Logistics", area: null },
  { id: "L1-016", mod: "L1", name: "Understands the basic controls and guidance plus the general principal & purpose of VPO", area: null },
  { id: "L1-017", mod: "L1", name: "Able to identify and deal with hazards, risks, operational controls during routine operations", area: null },
  { id: "L1-018", mod: "L1", name: "Understand the Red zone policy and general transport safety procedures", area: null },
  { id: "L1-019", mod: "L1", name: "Understand basic 5S principals and cleaning procedures within department", area: null },
  { id: "L1-020", mod: "L1", name: "Understand how to correctly segregate and manage waste in Logistics", area: null },
  { id: "L1-021", mod: "L1", name: "Understand the environmental hazards and risks in Logistics and know what to do in case of deviation", area: null },
  { id: "L1-022", mod: "L1", name: "Take immediate action when failures or process deviations occur", area: null },
  { id: "L1-023", mod: "L1", name: "Understand the principal of safe storage, all products and how this can be applied daily", area: "loading" },
  { id: "L1-024", mod: "L1", name: "Knows & is able to understand how to identify high risk tasks and process", area: null },
  { id: "L1-025", mod: "L1", name: "Understand the site safety & environment policy and how it applies in their job", area: null },
  { id: "L1-026", mod: "L1", name: "Actively report unsafe conditions in Logistics by reporting hazards", area: null },
  { id: "L1-027", mod: "L1", name: "Knows and follows manual handling rules – understanding risks and dangers", area: null },
  { id: "L1-028", mod: "L1", name: "Know and apply the principals of trailer safety - Safety sign blocker / counterbalance", area: null },
  { id: "L1-029", mod: "L1", name: "Trained in basic concepts of loading/unloading, line coverage and basic FLT Driving duties", area: null },
  { id: "L2-030", mod: "L2", name: "Understanding and familiarisation of Risk Assessments for tasks undertaken", area: null },
  { id: "L2-031", mod: "L2", name: "Understanding of basic principles of LOTOTO for shared areas", area: null },
  { id: "L2-032", mod: "L2", name: "Knows and can explain Blocked Stock process and execute necessary actions per SOP", area: "loading" },
  { id: "L2-033", mod: "L2", name: "Knows and applies incoming control procedure when receiving goods", area: "loading" },
  { id: "L2-034", mod: "L2", name: "Understand basic departmental SOPs and Acadia system", area: null },
  { id: "L2-035", mod: "L2", name: "Know the safety indicators related to their role (LTI, MDI, MTI, FAI)", area: null },
  { id: "L2-036", mod: "L2", name: "Understand the environmental impact of their role", area: null },
  { id: "L2-037", mod: "L2", name: "Know how to submit an idea via Bright Sparks", area: null },
  { id: "L2-038", mod: "L2", name: "Return material control / segregation by supplier types / loading correct pallets", area: "canline" },
  { id: "L2-039", mod: "L2", name: "Knows and understands loading and unloading procedures with load audit functionality", area: null },
  { id: "L2-040", mod: "L2", name: "Knows and understands how to operate storage racking systems", area: "loading" },
  { id: "L2-041", mod: "L2", name: "Knows and understands WMS to perform daily tasks", area: null },
  { id: "L2-042", mod: "L2", name: "Knows and understands how to print delivery notes", area: null },
  { id: "L2-043", mod: "L2", name: "Knows and understands how to receipt an inbound delivery into WMS", area: "loading" },
  { id: "L2-044", mod: "L2", name: "Loading in wet and adverse weather conditions, knowing SOP/Safety implications", area: null },
  { id: "L2-045", mod: "L2", name: "Knows and understands how to deal with basic stock system queries within WMS / SAP", area: null },
  { id: "L2-046", mod: "L2", name: "Knows and understands how to service a packaging line", area: "canline" },
  { id: "L2-047", mod: "L2", name: "Knows and understands how to deliver pallets of dry goods to/from the lines", area: null },
  { id: "L2-048", mod: "L2", name: "Knows and understands how to deal with spillages & breakages", area: null },
  { id: "L2-049", mod: "L2", name: "Knows and understands how to return empty packaging from line to store", area: null },
  { id: "L2-050", mod: "L2", name: "Knows and understands how to manage damaged pallets", area: "loading" },
  { id: "L2-051", mod: "L2", name: "Know where and how to store packaging materials, stacking heights and locations", area: "loading" },
  { id: "L2-052", mod: "L2", name: "Knows and understands how to perform 360 degree empty can pallet checks", area: "canline" },
  { id: "L2-053", mod: "L2", name: "Knows and understands Red Zone Safety rules", area: null },
  { id: "L2-054", mod: "L2", name: "Knows and understands trailer counter balance addition for Safety", area: null },
  { id: "L2-055", mod: "L2", name: "Knows and understands loading/unloading responsibilities", area: null },
  { id: "L2-056", mod: "L2", name: "Knows and understands how to operate storage racking systems", area: "loading" },
  { id: "L2-057", mod: "L2", name: "Knows and understands how to operate the keg area FLT with different fork attachments", area: "keg" },
  { id: "L2-058", mod: "L2", name: "Knows and understands the extra safety rules associated with operating within the keg yard", area: "keg" },
  { id: "L2-059", mod: "L2", name: "Knows and understands how to identify different types of empty keg products", area: "keg" },
  { id: "L2-060", mod: "L2", name: "Knows and understands how to identify different keg full products", area: "keg" },
  { id: "L2-061", mod: "L2", name: "Knows and understands how to sort empty kegs and prepare them before supply to DPAL", area: "keg" },
  { id: "L2-062", mod: "L2", name: "Knows and understands manual handling of kegs", area: "keg" },
  { id: "L2-063", mod: "L2", name: "Knows and understands loading/unloading responsibilities and load/weight segregation", area: "keg" },
  { id: "L3-064", mod: "L3", name: "Understands and can apply principles of effective VPO implementation linked to PI/KPIs", area: null },
  { id: "L3-065", mod: "L3", name: "EMCS & T1 Export document creation", area: null },
  { id: "L3-066", mod: "L3", name: "Piloting WH55 / 56 & also WH23", area: "loading" },
  { id: "L3-067", mod: "L3", name: "Processing shortages / chasing research on missing stock items", area: "loading" },
  { id: "L3-068", mod: "L3", name: "AFO operation and advanced awareness of system architecture", area: null },
  { id: "L3-069", mod: "L3", name: "Reprinting despatch notes and system investigation for error checking", area: null },
  { id: "L3-070", mod: "L3", name: "Experienced use and understanding of TMS system inc ability to run contingency file", area: null },
  { id: "L3-071", mod: "L3", name: "Recording shortages / identification of missing stock items / checking for parked tips", area: "loading" },
  { id: "L3-072", mod: "L3", name: "Liaising with 3PL Service providers", area: null },
  { id: "L3-073", mod: "L3", name: "Prioritising TMS / Customer demands & loading schedule attainment", area: null },
  { id: "L3-074", mod: "L3", name: "Removing LPs from TRF and ability to change WMS locations", area: "loading" },
  { id: "L3-075", mod: "L3", name: "Ability to release RF of staff out of WMS", area: null },
  { id: "L3-076", mod: "L3", name: "Advanced knowledge of VPO within the department", area: null },
  { id: "L4-077", mod: "L4", name: "Understanding and able to demonstrate awareness of the Logistics Pillar Handbook", area: null },
  { id: "L4-078", mod: "L4", name: "Generation of 5Y / RCA / Problem solving / Data compilation linked to VPO Tools", area: null },
  { id: "L4-079", mod: "L4", name: "Update daily / weekly KPI boards & folders", area: null },
  { id: "L4-080", mod: "L4", name: "Use / completion / understanding of ESW/OWD & PGI process", area: null },
  { id: "L4-081", mod: "L4", name: "Advanced system user - SAP, WMS, TMS inc troubleshooting", area: null },
  { id: "L4-082", mod: "L4", name: "Piloting duties of all areas with fluency", area: null },
  { id: "L4-083", mod: "L4", name: "Incident investigation & reporting to ABI/BBG standards", area: null },
  { id: "L4-084", mod: "L4", name: "Able to control 3PL trailer supply, empty keg supply, coordinating manpower", area: null },
  { id: "L4-085", mod: "L4", name: "Understanding and ability to review, validate and complete yields", area: null },
  { id: "L4-086", mod: "L4", name: "Attend and participate in the daily operations meeting if needed", area: null },
  { id: "L4-087", mod: "L4", name: "Able to manage and communicate clearly of the deferral of dry goods process", area: null },
  { id: "L4-088", mod: "L4", name: "Block stock report compilation and check / recording of errors end to end", area: "loading" },
  { id: "L4-089", mod: "L4", name: "PV stock On / Off", area: "loading" },
  { id: "L4-090", mod: "L4", name: "Export Container Controls loading patterns and paperwork", area: null },
  { id: "L4-091", mod: "L4", name: "SLOC control", area: null },
  { id: "L4-092", mod: "L4", name: "Investigation of failed delivery notes and inbound products", area: null },
  { id: "L4-093", mod: "L4", name: "Replay of inbound and outbound orders", area: null },
  { id: "L4-094", mod: "L4", name: "Application of ZD22 - manual mode controls", area: null },
  { id: "L5-095", mod: "L5", name: "Advanced knowledge of VPO, supporting daily tools and process routines", area: null },
  { id: "L5-096", mod: "L5", name: "Understanding and able to demonstrate awareness of BD, PM, PDCA", area: null },
  { id: "L5-097", mod: "L5", name: "Generation of 5Y / RCA / Problem solving / Data compilation", area: null },
  { id: "L5-098", mod: "L5", name: "Update daily / weekly KPI boards & folders", area: null },
  { id: "L5-099", mod: "L5", name: "Use / completion / understanding of ESW & OWD process", area: null },
  { id: "L5-100", mod: "L5", name: "Advanced system user - SAP, WMS, TMS inc troubleshooting", area: null },
  { id: "L5-101", mod: "L5", name: "Piloting duties of all areas with fluency", area: null },
  { id: "L5-102", mod: "L5", name: "Incident investigation & reporting to ABI/BBG standards", area: null },
  { id: "L5-103", mod: "L5", name: "Managing and monitoring traffic flows", area: null },
  { id: "L5-104", mod: "L5", name: "Understanding and ability to review, validate and complete yields", area: null },
  { id: "L5-105", mod: "L5", name: "Attend and participate in the daily operations meeting if needed", area: null },
  { id: "L5-106", mod: "L5", name: "Able to manage and communicate of the deferral of dry goods process", area: null },
  { id: "L5-107", mod: "L5", name: "Block stock report compilation and check / recording of errors", area: "loading" },
  { id: "L5-108", mod: "L5", name: "PV stock On / Off", area: "loading" },
  { id: "L5-109", mod: "L5", name: "Export Container Controls", area: null },
  { id: "L5-110", mod: "L5", name: "SLOC control", area: null },
  { id: "L5-111", mod: "L5", name: "Investigation of failed delivery notes and inbound products", area: null },
  { id: "L5-112", mod: "L5", name: "Replay of inbound and outbound orders", area: null },
  { id: "L5-113", mod: "L5", name: "Application of ZD22 - manual mode controls", area: null },
  { id: "L5-114", mod: "L5", name: "EMCS interface issues - ZS89Q", area: null },
  { id: "L6-115", mod: "L6", name: "Advanced VPO knowledge with view to Autonomous Operations", area: null },
  { id: "L6-116", mod: "L6", name: "Undertake shift handover when covering for FLM", area: null },
  { id: "L6-117", mod: "L6", name: "Record accidents & incidents via Injury Notification/24hr Form", area: null },
  { id: "L6-118", mod: "L6", name: "Conduct handover to oncoming FLM/Multi Operator", area: null },
  { id: "L6-119", mod: "L6", name: "Complete KPI reports and handover logs with all relevant data", area: null },
  { id: "L6-120", mod: "L6", name: "Support facilitation and allocation of manpower resource", area: null },
  { id: "L6-121", mod: "L6", name: "Facilitate effective communication of loading plan priorities", area: null },
  { id: "L6-122", mod: "L6", name: "Support in creating and updating SOPs and OPLs", area: null },
  { id: "L6-123", mod: "L6", name: "Contribute to departmental ITF initiatives", area: null },
  { id: "L6-124", mod: "L6", name: "Attend and participate in daily meetings as key team member", area: null },
  { id: "L6-125", mod: "L6", name: "Schedule reconciliation with Packaging teams", area: null },
  { id: "L6-126", mod: "L6", name: "Carry out Quality Block Stock checks and blocking/releasing stock", area: "loading" },
  { id: "L6-127", mod: "L6", name: "Check housekeeping standards, monitor WMS work queue", area: null },
  { id: "L6-128", mod: "L6", name: "Monitor SIGMA throughout shift for Logistics service", area: null },
  { id: "L6-129", mod: "L6", name: "Support Logistics Operations to deliver loading plan and line service", area: null },
  { id: "L6-130", mod: "L6", name: "Ensure all departmental assets including FLTs operated safely", area: null },
  { id: "L6-131", mod: "L6", name: "Comply with all statutory, legal, quality and food hygiene regulations", area: null },
];

/* ═══════════════════════════════════════════════════
   PRODUCTION LINES — SHARED
   ═══════════════════════════════════════════════════ */
const INIT_LINES = [
  { id: "canline", name: "Can Line", machines: [{ id: "MAC1", name: "MAC1" }, { id: "MAC2", name: "MAC2" }, { id: "MAB3", name: "MAB3" }], normalOps: 4, minOps: 3 },
  { id: "botline", name: "Bot Line", machines: [{ id: "MAB1", name: "MAB1" }, { id: "MAB2", name: "MAB2" }], normalOps: 2, minOps: 1 },
  { id: "keg", name: "Keg Line", machines: [{ id: "MAK1", name: "MAK1" }], normalOps: 2, minOps: 2 }, // inside + outside
  { id: "corona", name: "Corona", machines: [{ id: "MAB4", name: "MAB4" }], normalOps: 1, minOps: 1 },
];
const INIT_AREAS = [
  { id: "canline", name: "Can Line", type: "line", lineId: "canline", areaTag: "canline" },
  { id: "botline", name: "Bot Line", type: "line", lineId: "botline", areaTag: "botline" },
  { id: "keg_in", name: "Kegging Inside", type: "line", lineId: "keg", areaTag: "keg", role: "inside" },
  { id: "keg_out", name: "Kegging Outside", type: "line", lineId: "keg", areaTag: "keg", role: "outside" },
  { id: "corona", name: "Corona", type: "line", lineId: "corona", areaTag: "corona" },
  { id: "magor1", name: "Magor 1 Loading", type: "loading", lineId: null, areaTag: "loading", tmsArea: "MAGCAN", min: 1 },
  { id: "tents", name: "Tent Loading", type: "loading", lineId: null, areaTag: "loading", tmsArea: "MAGNEW", min: 2 },
  { id: "kegload", name: "Keg Loading", type: "loading", lineId: null, areaTag: "loading", tmsArea: "MAGKEG", min: 1 },
  { id: "packaging", name: "Packaging", type: "fixed", lineId: null, areaTag: "packaging", min: 1 },
  { id: "office", name: "Office", type: "office", lineId: null, areaTag: "office", min: 2 },
];

/* ═══════════════════════════════════════════════════
   SHIFT DEFAULTS
   ═══════════════════════════════════════════════════ */
const SHIFTS = [
  { id: "tA", name: "A Shift", color: "#F59E0B", anchor: "2026-02-03", icon: "A", flm: "Mike Thomas" },
  { id: "tB", name: "B Shift", color: "#3B82F6", anchor: "2026-02-05", icon: "B", flm: "Jamie Morgan" },
  { id: "tC", name: "C Shift", color: "#10B981", anchor: "2026-01-30", icon: "C", flm: "Steve Wilson" },
  { id: "tD", name: "D Shift", color: "#A855F7", anchor: "2026-02-01", icon: "D", flm: "Neil Bridgeman" },
];

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

/* ═══════════════════════════════════════════════════
   BUILT-IN PLAN DATA (Feb 2026)
   ═══════════════════════════════════════════════════ */
const PLAN_STATUS = { "2026-02-06": { "MAB1": true, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": false, "MAC2": true, "MAK1": true }, "2026-02-07": { "MAB1": true, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": false, "MAC2": true, "MAK1": true }, "2026-02-08": { "MAB1": false, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": false, "MAC2": true, "MAK1": false }, "2026-02-09": { "MAB1": true, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": true }, "2026-02-10": { "MAB1": true, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": true }, "2026-02-11": { "MAB1": true, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": true }, "2026-02-12": { "MAB1": true, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": true }, "2026-02-13": { "MAB1": true, "MAB2": true, "MAB3": false, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": true }, "2026-02-14": { "MAB1": true, "MAB2": false, "MAB3": false, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false }, "2026-02-15": { "MAB1": true, "MAB2": false, "MAB3": false, "MAB4": false, "MAC1": false, "MAC2": true, "MAK1": false }, "2026-02-16": { "MAB1": true, "MAB2": false, "MAB3": true, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false }, "2026-02-17": { "MAB1": true, "MAB2": false, "MAB3": true, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false }, "2026-02-18": { "MAB1": true, "MAB2": false, "MAB3": true, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false }, "2026-02-19": { "MAB1": true, "MAB2": true, "MAB3": true, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false }, "2026-02-20": { "MAB1": true, "MAB2": true, "MAB3": true, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false }, "2026-02-21": { "MAB1": false, "MAB2": true, "MAB3": true, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false }, "2026-02-22": { "MAB1": false, "MAB2": false, "MAB3": false, "MAB4": true, "MAC1": true, "MAC2": true, "MAK1": false } };
const PLAN_PRODUCTS = { "2026-02-06": { "MAB1": "102477", "MAB2": "109439/109426", "MAB4": "99150/109919", "MAC2": "71219", "MAK1": "88755/102647/88754" }, "2026-02-07": { "MAB1": "102477/70909", "MAB2": "109429/102786", "MAB4": "109935", "MAC2": "103491/108958", "MAK1": "88754" }, "2026-02-08": { "MAB2": "102786/70880", "MAB4": "99147", "MAC2": "62232/102949/101031/101033" }, "2026-02-09": { "MAB1": "106113", "MAB2": "100255/99802", "MAB4": "70880/99149", "MAC1": "107451/93980", "MAC2": "101033/71219", "MAK1": "102738" }, "2026-02-10": { "MAB1": "111174", "MAB2": "99149", "MAB4": "109945/99146", "MAC1": "93980", "MAC2": "71219", "MAK1": "109852" }, "2026-02-11": { "MAB1": "111174", "MAB2": "109427", "MAB4": "99154/105531", "MAC1": "111514/101040", "MAC2": "71219", "MAK1": "103061/95068/92223" }, "2026-02-12": { "MAB1": "109649", "MAB2": "77733", "MAB4": "105531", "MAC1": "82765/107439/102761", "MAC2": "71219", "MAK1": "109647/106466" }, "2026-02-13": { "MAB1": "109649/62766", "MAB2": "109989", "MAB4": "105531", "MAC1": "99200/98864/103666/98865", "MAC2": "71219/109555", "MAK1": "91554/106942/72493" }, "2026-02-14": { "MAB1": "62766", "MAB4": "105531", "MAC1": "111514", "MAC2": "71242" }, "2026-02-15": { "MAB1": "108280/70911", "MAC2": "71242" }, "2026-02-16": { "MAB1": "70878", "MAB3": "62649", "MAB4": "99150", "MAC1": "71242", "MAC2": "111514" }, "2026-02-17": { "MAB1": "71248", "MAB3": "62649/62651", "MAB4": "99150", "MAC1": "108958/62232", "MAC2": "109092/107439" }, "2026-02-18": { "MAB1": "102785/102772", "MAB3": "62651", "MAB4": "109919", "MAC1": "101031/101034", "MAC2": "107439" }, "2026-02-19": { "MAB1": "102772/70909", "MAB2": "99214", "MAB3": "111120", "MAB4": "109919", "MAC1": "111120", "MAC2": "82739/110376/109780" }, "2026-02-20": { "MAB1": "70909", "MAB2": "100257", "MAB3": "61625/111518", "MAB4": "109937/99151", "MAC1": "71219", "MAC2": "102951/102952" }, "2026-02-21": { "MAB2": "100257", "MAB3": "111518/109777", "MAB4": "109610/109623", "MAC1": "71219", "MAC2": "101002/102953/82739" }, "2026-02-22": { "MAB4": "109623/99803", "MAC1": "109623", "MAC2": "102740" } };

/* ═══════════════════════════════════════════════════
   STORAGE HELPERS
   ═══════════════════════════════════════════════════ */
// Supabase client
const SUPA_URL = "https://nuxntitedixiijtxzuni.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eG50aXRlZGl4aWlqdHh6dW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTQzMjQsImV4cCI6MjA4NTk3MDMyNH0.Wpzpo2_KE07S7xe7SEQQsaRTff6YAAJeiMDz1JRJaak";
async function sGet(key) {
  try {
    const resp = await fetch(`${SUPA_URL}/rest/v1/app_data?key=eq.${encodeURIComponent(key)}&select=value`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` }
    });
    if (!resp.ok) return null;
    const rows = await resp.json();
    return rows.length > 0 ? rows[0].value : null;
  } catch (e) { console.error("sGet error:", e); return null }
}
async function sSet(key, val) {
  try {
    await fetch(`${SUPA_URL}/rest/v1/app_data`, {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({ key, value: val })
    });
  } catch (e) { console.error("sSet error:", e) }
}

/* ═══════════════════════════════════════════════════
   QUALIFICATION / ELIGIBILITY LOGIC
   ═══════════════════════════════════════════════════ */
const QUAL_AREAS = [
  { id: "canline", name: "Can Line", short: "CL", color: "#10B981" },
  { id: "botline", name: "Bot Line", short: "BL", color: "#10B981" },
  { id: "keg_in", name: "Kegging Inside", short: "KI", color: "#10B981" },
  { id: "keg_out", name: "Kegging Outside", short: "KO", color: "#10B981" },
  { id: "corona", name: "Corona", short: "CO", color: "#10B981" },
  { id: "magor1", name: "Magor 1 Loading", short: "M1", color: "#3B82F6" },
  { id: "tents", name: "Tent Loading", short: "TL", color: "#3B82F6" },
  { id: "kegload", name: "Keg Loading", short: "KL", color: "#3B82F6" },
  { id: "packaging", name: "Packaging", short: "PK", color: "#64748B" },
  { id: "office", name: "Office", short: "OF", color: "#A855F7" },
];

function canWorkArea(opId, areaId, ops) {
  const op = ops.find(o => o.id === opId);
  if (!op) return false;
  const quals = op.quals || [];
  // If no quals set yet, allow all except office (backwards compat)
  if (!quals.length) return areaId !== "office";
  return quals.includes(areaId);
}
function getEligibleAreas(opId, areas, ops, training) {
  // Check manual quals OR SKAP-based eligibility
  return areas.filter(a => {
    // Manual qual always works
    if (canWorkArea(opId, a.id, ops)) return true;
    // SKAP-based: check if relevant SKAP tasks for this area are completed
    if (!training?.[opId]) return false;
    const opT = training[opId];
    // Map area IDs to SKAP task area tags
    const areaToSkap = {
      canline: ["canline"], botline: ["canline"], corona: ["canline"],
      magor1: ["loading"], tents: ["loading"],
      keg_in: ["keg"], keg_out: ["keg"], kegload: ["keg"],
      packaging: ["canline", "loading"],
      office: ["loading"]
    };
    const skapTags = areaToSkap[a.id];
    if (!skapTags) return false;
    // Get all SKAP tasks tagged for these areas
    const relevantTasks = SKAP_TASKS.filter(t => t.area && skapTags.includes(t.area));
    if (!relevantTasks.length) return false;
    // Eligible if 80%+ of relevant tasks completed
    const completed = relevantTasks.filter(t => opT[t.id] === "completed").length;
    return completed >= Math.ceil(relevantTasks.length * 0.8);
  });
}
function getSkapProgress(opId, training) {
  return SKAP_MODULES.map(mod => {
    const tasks = SKAP_TASKS.filter(t => t.mod === mod.id);
    const comp = tasks.filter(t => (training[opId]?.[t.id]) === "completed").length;
    const intrn = tasks.filter(t => (training[opId]?.[t.id]) === "training").length;
    return { ...mod, total: tasks.length, completed: comp, inTraining: intrn, pct: Math.round((comp / tasks.length) * 100) };
  });
}

/* ═══════════════════════════════════════════════════
   ROTATION TRACKING HELPERS
   ═══════════════════════════════════════════════════ */
/**
 * Calculate weeks since operator worked in an area.
 * @param {string} opId - Operator ID
 * @param {string} areaId - Area ID
 * @param {Array} rotationHistory - Rotation history records
 * @returns {number} Weeks since last worked (999 if never)
 */
function weeksSinceWorked(opId, areaId, rotationHistory) {
  if (!rotationHistory || rotationHistory.length === 0) return 999; // Never worked

  const areaHistory = rotationHistory
    .filter(h => h.operator_id === opId && h.area_id === areaId)
    .sort((a, b) => new Date(b.week_date) - new Date(a.week_date));

  if (areaHistory.length === 0) return 999; // Never worked in this area

  const lastWorked = new Date(areaHistory[0].week_date);
  const now = new Date();
  const diffTime = Math.abs(now - lastWorked);
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

  return diffWeeks;
}

/**
 * Get rotation score for sorting (higher = should work here).
 * @param {string} opId - Operator ID
 * @param {string} areaId - Area ID
 * @param {Array} rotationHistory - Rotation history records
 * @returns {number} Rotation score
 */
function getRotationScore(opId, areaId, rotationHistory) {
  const weeks = weeksSinceWorked(opId, areaId, rotationHistory);
  // Operators who haven't worked here recently get higher scores
  return weeks;
}

/**
 * Save week's assignments to rotation history in Supabase.
 * @param {string} weekDate - Week start date (YYYY-MM-DD)
 * @param {string} shiftId - Shift ID
 * @param {Object} assignments - Daily assignments { date: { opId: areaId } }
 * @param {Array} ops - Operators list
 */
async function saveWeekRotationHistory(weekDate, shiftId, assignments, ops) {
  const { saveRotas, loadRotas, saveRotationHistory, getRotationHistory, getAllRotationHistory, getOperatorWorkStats } = await import('./utils/supabaseClient.js');

  // Calculate hours per assignment (assuming 40-hour week)
  const hoursPerWeek = 40;

  // Aggregate assignments by operator and area
  const opAreaMap = {};

  Object.values(assignments).forEach(dailyAssign => {
    Object.entries(dailyAssign).forEach(([opId, areaId]) => {
      const op = ops.find(o => o.id === opId);
      if (!op || op.isAgency) return; // Only track FTE

      const key = `${opId}_${areaId}`;
      if (!opAreaMap[key]) {
        opAreaMap[key] = { opId, areaId, count: 0 };
      }
      opAreaMap[key].count++;
    });
  });

  // Save to Supabase
  for (const { opId, areaId, count } of Object.values(opAreaMap)) {
    const hours = (count / 7) * hoursPerWeek; // Proportional hours
    await saveRotationHistory(opId, weekDate, areaId, hours, shiftId);
  }
}

/**
 * Generate training plan based on rotation history.
 * Identifies operators who need exposure to areas they're qualified for but haven't worked recently.
 * @param {Array} ops - Operators list
 * @param {Array} areas - Areas list
 * @param {Array} rotationHistory - Rotation history records
 * @returns {Array} Training needs with priority levels
 */
function generateTrainingPlan(ops, areas, rotationHistory) {
  const trainingNeeds = [];

  ops.filter(op => !op.isAgency).forEach(op => {
    areas.forEach(area => {
      // Skip if not qualified
      if (!canWorkArea(op.id, area.id, ops)) return;

      const weeks = weeksSinceWorked(op.id, area.id, rotationHistory);

      let priority = null;
      if (weeks >= 8) priority = 'high';
      else if (weeks >= 4) priority = 'medium';
      else if (weeks >= 2) priority = 'low';

      if (priority) {
        trainingNeeds.push({
          operatorId: op.id,
          operatorName: op.name,
          areaId: area.id,
          areaName: area.name,
          weeksAgo: weeks === 999 ? 'Never' : weeks,
          priority
        });
      }
    });
  });

  return trainingNeeds.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

/* ═══════════════════════════════════════════════════
   ROTA ENGINE
   ═══════════════════════════════════════════════════ */
function genRota(ops, areas, lines, team, hols, weekStart, prevAssign, training, machineStatus, loadingData, staffingPlan, rotationHistory = []) {
  const warns = [], assigns = {}, grid = {};
  const dates = Array.from({ length: 7 }, (_, i) => ad(weekStart, i));
  const hist = {}; ops.forEach(o => { hist[o.id] = {} });
  Object.values(prevAssign).forEach(ba => Object.entries(ba).forEach(([oid, aid]) => { if (hist[oid]) hist[oid][aid] = (hist[oid][aid] || 0) + 1 }));
  const anchor = parse(team.anchor);
  const bStarts = new Set();
  dates.forEach(d => { if (stype(anchor, d) !== "off") { const b = bstart(anchor, d); if (b) bStarts.add(fmt(b)) } });

  // Staffing plan lookup
  const spKey = team.id.replace(/^t/i, "").toUpperCase();
  const spOps = staffingPlan?.fte?.[spKey] || [];
  const spAgency = staffingPlan?.agency || [];
  const isSpOff = (opName, ds) => {
    if (!spOps.length) return false;
    const match = spOps.find(sp => sp.name.toLowerCase().trim() === opName.toLowerCase().trim());
    if (!match) return false;
    const st = match.days[ds];
    if (!st) return false;
    return !["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(st);
  };

  // Build agency availability for this shift's working days — use ops list only
  const getAvailAgency = (wDays) => {
    return ops.filter(o => o.isAgency).filter(ag => {
      const spMatch = spAgency.find(sp => sp.name.toLowerCase().trim() === ag.name.toLowerCase().trim());
      if (!spMatch) return false;
      // Only D or N count as working (not PD/DISDAM)
      return wDays.some(w => {
        const st = spMatch.days[w.ds];
        return st === "D" || st === "N";
      });
    });
  };

  // Helper: count TMS loads
  const countLoads = (ds, shiftType, tmsArea) => {
    if (!loadingData || !loadingData.length) return 0;
    return loadingData.filter(r => r.date === ds && r.shift === shiftType && r.areaCode === tmsArea).length;
  };

  bStarts.forEach(bsStr => {
    const bsd = parse(bsStr);
    const wDays = Array.from({ length: 4 }, (_, i) => ({ date: ad(bsd, i), ds: fmt(ad(bsd, i)), st: CYCLE[i] }));
    const inWeek = wDays.filter(w => dates.some(d => fmt(d) === w.ds));
    if (!inWeek.length) return;
    const bk = `${team.id}_${bsStr}`;
    if (!prevAssign[bk]) {
      // FTE availability
      const availFTE = ops.filter(op => {
        if (op.isAgency) return false; // Handle agency separately
        if (wDays.some(w => hols.some(h => h.opId === op.id && w.ds >= h.start && w.ds <= h.end))) return false;
        if (spOps.length > 0) {
          const match = spOps.find(sp => sp.name.toLowerCase().trim() === op.name.toLowerCase().trim());
          if (match) {
            const is10M = Object.values(match.days).some(v => v === "10M");
            if (is10M) {
              const hasWorkDay = wDays.some(w => { const s = match.days[w.ds]; return s === "D" || s === "N" || s === "DISDAM" || s === "PD-DAYS" || s === "PD-NIGHTS" });
              if (!hasWorkDay) return false;
            }
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

      // Agency availability
      const availAgency = getAvailAgency(wDays);

      // Calculate needs
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
            else need = line.id === "canline" ? (running < line.machines.length ? line.minOps : line.normalOps) : line.normalOps;
          }
        } else if (area.type === "loading") {
          let maxNeed = 0;
          wDays.forEach(w => {
            const shiftType = w.st;
            const loads = countLoads(w.ds, shiftType, area.tmsArea);
            const n = Math.ceil(loads / LOADS_PER_OP);
            if (n > maxNeed) maxNeed = n;
          });
          need = maxNeed || area.min || 0;
        } else if (area.type === "office") {
          let maxCombined = 0;
          wDays.forEach(w => {
            const m1 = countLoads(w.ds, w.st, "MAGCAN");
            const tn = countLoads(w.ds, w.st, "MAGNEW");
            if (m1 + tn > maxCombined) maxCombined = m1 + tn;
          });
          need = Math.min(maxCombined >= 50 ? 2 : 1, 2);
        } else if (area.type === "fixed") {
          need = area.min || 1;
        }

        let eligible = availFTE.filter(op => canWorkArea(op.id, area.id, ops));
        let eligibleAgency = availAgency.filter(ag => ag.quals?.includes(area.id));

        return { ...area, need, eligible, eligibleAgency };
      }).filter(a => a.need > 0).sort((a, b) => a.eligible.length - b.eligible.length);

      // Phase 0: Assign operators with preferred areas first (FTE)
      const ba = {}, usedFTE = new Set(), usedAgency = new Set();

      // FTE with preferences — assign them to their preferred area if it needs people
      availFTE.filter(op => op.prefArea).forEach(op => {
        const area = areaNeeds.find(a => a.id === op.prefArea);
        if (!area) return;
        const assigned = Object.values(ba).filter(v => v === area.id).length;
        if (assigned < area.need && canWorkArea(op.id, area.id, ops)) {
          ba[op.id] = area.id; usedFTE.add(op.id);
        }
      });

      // Agency with preferences
      availAgency.filter(ag => ag.prefArea).forEach(ag => {
        const area = areaNeeds.find(a => a.id === ag.prefArea);
        if (!area) return;
        const assigned = Object.values(ba).filter(v => v === area.id).length;
        if (assigned < area.need && ag.quals?.includes(area.id)) {
          ba[ag.id] = area.id; usedAgency.add(ag.id);
        }
      });

      // Phase 1: Can line areas — ensure at least 1 FTE each
      const canLineAreas = areaNeeds.filter(a => a.lineId === "canline");
      const otherAreas = areaNeeds.filter(a => a.lineId !== "canline");

      // Ensure at least 1 FTE on each can line area (skip if pref already assigned one)
      canLineAreas.forEach(area => {
        const assigned = Object.values(ba).filter(v => v === area.id).length;
        const hasFTE = Object.entries(ba).some(([id, aid]) => aid === area.id && !availAgency.some(ag => ag.id === id));
        if (!hasFTE && assigned < area.need) {
          // ROTATION-AWARE: Sort FTE by rotation score (prefer those who haven't worked can line recently)
          const fteCands = area.eligible
            .filter(o => !usedFTE.has(o.id))
            .map(o => ({
              ...o,
              rotationScore: getRotationScore(o.id, area.id, rotationHistory),
              histScore: (hist[o.id]?.[area.id] || 0)
            }))
            .sort((a, b) => {
              // Primary: rotation (higher weeks = higher priority)
              if (b.rotationScore !== a.rotationScore) {
                return b.rotationScore - a.rotationScore;
              }
              // Secondary: historical balance (lower = higher priority)
              return a.histScore - b.histScore;
            });
          if (fteCands.length > 0) {
            ba[fteCands[0].id] = area.id; usedFTE.add(fteCands[0].id);
          }
        }
      });

      // Fill remaining can line needs with agency, then more FTE
      canLineAreas.forEach(area => {
        const assigned = Object.values(ba).filter(v => v === area.id).length;
        const remaining = area.need - assigned;
        if (remaining <= 0) return;
        // Try agency first for remaining slots
        const agCands = area.eligibleAgency.filter(o => !usedAgency.has(o.id));
        agCands.slice(0, remaining).forEach(o => { ba[o.id] = area.id; usedAgency.add(o.id) });
        // If still short, use more FTE
        const stillNeeded = remaining - Math.min(agCands.length, remaining);
        if (stillNeeded > 0) {
          // ROTATION-AWARE: Additional FTE for can line
          const fteCands = area.eligible
            .filter(o => !usedFTE.has(o.id))
            .map(o => ({
              ...o,
              rotationScore: getRotationScore(o.id, area.id, rotationHistory),
              histScore: (hist[o.id]?.[area.id] || 0)
            }))
            .sort((a, b) => {
              if (b.rotationScore !== a.rotationScore) {
                return b.rotationScore - a.rotationScore;
              }
              return a.histScore - b.histScore;
            });
          fteCands.slice(0, stillNeeded).forEach(o => { ba[o.id] = area.id; usedFTE.add(o.id) });
        }
      });

      // Phase 2: Assign other areas — FTE first, then agency (ROTATION-AWARE)
      otherAreas.forEach(area => {
        const assigned = Object.values(ba).filter(v => v === area.id).length;
        const remaining = area.need - assigned;
        if (remaining <= 0) return;
        // FTE first (rotation-aware)
        const fteCands = area.eligible
          .filter(o => !usedFTE.has(o.id))
          .map(o => ({
            ...o,
            rotationScore: getRotationScore(o.id, area.id, rotationHistory),
            histScore: (hist[o.id]?.[area.id] || 0)
          }))
          .sort((a, b) => {
            // Primary: rotation (higher weeks = higher priority)
            if (b.rotationScore !== a.rotationScore) {
              return b.rotationScore - a.rotationScore;
            }
            // Secondary: historical balance (lower = higher priority)
            return a.histScore - b.histScore;
          });
        fteCands.slice(0, remaining).forEach(o => { ba[o.id] = area.id; usedFTE.add(o.id) });
        // Agency for remaining
        const stillNeeded = remaining - Math.min(fteCands.length, remaining);
        if (stillNeeded > 0) {
          const agCands = area.eligibleAgency.filter(o => !usedAgency.has(o.id));
          agCands.slice(0, stillNeeded).forEach(o => { ba[o.id] = area.id; usedAgency.add(o.id) });
        }
        if (Object.values(ba).filter(v => v === area.id).length < area.need)
          warns.push(`${area.name} needs ${area.need}, got ${Object.values(ba).filter(v => v === area.id).length}`);
      });

      // Phase 3: Leftover agency → Tents loading
      availAgency.filter(o => !usedAgency.has(o.id)).forEach(ag => {
        ba[ag.id] = "tents"; usedAgency.add(ag.id);
      });

      // Phase 4: Leftover FTE → fill underfilled areas
      availFTE.filter(o => !usedFTE.has(o.id)).forEach(op => {
        const el = areaNeeds.filter(a => {
          if (!canWorkArea(op.id, a.id, ops)) return false;
          const assigned = Object.values(ba).filter(v => v === a.id).length;
          return assigned < a.need;
        });
        if (el.length) { const best = el.sort((a, b) => (hist[op.id]?.[a.id] || 0) - (hist[op.id]?.[b.id] || 0))[0]; ba[op.id] = best.id; usedFTE.add(op.id) }
      });

      assigns[bk] = ba;
    } else { assigns[bk] = prevAssign[bk] }
    inWeek.forEach(w => {
      if (!grid[w.ds]) grid[w.ds] = {};
      const ba = assigns[`${team.id}_${bsStr}`] || {};
      // Grid for FTE ops
      ops.forEach(op => {
        if (op.isAgency) return; // agency handled below
        const hol = hols.some(h => h.opId === op.id && w.ds >= h.start && w.ds <= h.end);
        const spOff = isSpOff(op.name, w.ds);
        if (hol || spOff) {
          const match = spOps.find(sp => sp.name.toLowerCase().trim() === op.name.toLowerCase().trim());
          const reason = match?.days[w.ds] || "H";
          grid[w.ds][op.id] = { area: null, st: w.st, tc: team.color, off: true, reason };
        } else if (ba[op.id]) {
          grid[w.ds][op.id] = { area: ba[op.id], st: w.st, tc: team.color };
        }
      });
      // Grid for agency ops
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

/* ═══════════════════════════════════════════════════
   STYLES & ICONS
   ═══════════════════════════════════════════════════ */
const S = {
  card: { background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 20, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" },
  bp: { background: "linear-gradient(135deg,var(--primary),#C39B0E)", color: "var(--primary-fg)", border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Satoshi', sans-serif", display: "flex", alignItems: "center", gap: 8 },
  bg: { background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Satoshi', sans-serif", display: "flex", alignItems: "center", gap: 6 },
  inp: { background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "12px 16px", color: "var(--text-primary)", fontFamily: "'Roboto', sans-serif", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
  lbl: { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Satoshi', sans-serif" },
  chip: c => ({ display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c ? `${c}22` : "var(--bg-hover)", color: c || "var(--text-secondary)", border: `1px solid ${c ? `${c}44` : "var(--border-color)"}`, fontFamily: "'Satoshi', sans-serif" }),
};
const Ic = {
  Sun: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  Moon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  MoonSmall: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  Left: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>,
  Right: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>,
  Shuffle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>,
  Warn: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>,
  Back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>,
};

/* ═══════════════════════════════════════════════════
   ONBOARDING WIZARD
   ═══════════════════════════════════════════════════ */
function OnboardingWizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(1);

  const modalOverlay = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20
  };

  const modalCard = {
    background: 'var(--bg-card)',
    borderRadius: 12,
    padding: 40,
    maxWidth: 600,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    position: 'relative'
  };

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        {/* Skip button */}
        <button
          onClick={onSkip}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 8px'
          }}
        >
          Skip →
        </button>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800 }}>
              Welcome to Shift Rota Manager!
            </h2>
            <p style={{ fontSize: 15, color: '#64748B', marginBottom: 32, lineHeight: 1.6 }}>
              Let's get you started in 3 simple steps. This quick setup will help you understand the basics.
            </p>

            <div style={{ display: 'grid', gap: 12, marginBottom: 32, textAlign: 'left' }}>
              <div style={{ ...S.card, padding: 16, background: 'rgba(59,130,246,0.08)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#3B82F6' }}>
                  📅 Step 1: Upload Staffing Plan
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Upload your Excel staffing plan to get started
                </div>
              </div>
              <div style={{ ...S.card, padding: 16, background: 'rgba(16,185,129,0.08)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#10B981' }}>
                  ⚙️ Step 2: Configure Settings
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Set up your shifts and production areas
                </div>
              </div>
              <div style={{ ...S.card, padding: 16, background: 'rgba(139,92,246,0.08)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#8B5CF6' }}>
                  🚀 Step 3: Generate Your First Rota
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Create your first automated rota
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              style={{
                ...S.bp,
                background: '#3B82F6',
                color: '#fff',
                padding: '12px 32px',
                fontSize: 15,
                fontWeight: 700
              }}
            >
              Get Started →
            </button>
          </div>
        )}

        {/* Step 2: Quick Tips */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>💡</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, textAlign: 'center' }}>
              Quick Tips for Success
            </h2>
            <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, textAlign: 'center' }}>
              Here are some helpful tips to get the most out of the app
            </p>

            <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                <div style={{ fontSize: 24 }}>📊</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    Rotation Tracking
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                    The system automatically tracks where operators work to ensure fair rotation across all areas
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                <div style={{ fontSize: 24 }}>✅</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    Confirmation Before Saving
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                    Always review the confirmation modal before saving rotas to the database
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                <div style={{ fontSize: 24 }}>❓</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    Need Help?
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                    Click the help button (?) anytime for detailed guidance on any feature
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  ...S.bg,
                  background: 'var(--bg-body)',
                  flex: 1
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  ...S.bp,
                  background: '#3B82F6',
                  color: '#fff',
                  flex: 2
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ready to Go */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800 }}>
              You're All Set!
            </h2>
            <p style={{ fontSize: 15, color: '#64748B', marginBottom: 32, lineHeight: 1.6 }}>
              You're ready to start using Shift Rota Manager. Upload your staffing plan to begin.
            </p>

            <div style={{ ...S.card, padding: 20, marginBottom: 32, background: 'rgba(16,185,129,0.08)', borderLeft: '4px solid #10B981' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#10B981' }}>
                🚀 Next Steps:
              </div>
              <div style={{ fontSize: 13, color: '#64748B', textAlign: 'left', lineHeight: 1.6 }}>
                1. Upload your staffing plan (Excel file)<br />
                2. Select a shift to manage<br />
                3. Click "Generate Rota" to create your first automated schedule
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  ...S.bg,
                  background: 'var(--bg-body)',
                  flex: 1
                }}
              >
                ← Back
              </button>
              <button
                onClick={onComplete}
                style={{
                  ...S.bp,
                  background: '#10B981',
                  color: '#fff',
                  flex: 2,
                  fontSize: 15,
                  fontWeight: 700
                }}
              >
                Start Using App →
              </button>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: step === i ? '#3B82F6' : '#E2E8F0',
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DEPARTMENT SICKNESS CARD
   ═══════════════════════════════════════════════════ */
function DepartmentSicknessCard({ totalOperators = 40 }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDepartmentSicknessRate(6, totalOperators)
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading sickness stats:', err);
        setLoading(false);
      });
  }, [totalOperators]);

  if (loading) {
    return (
      <div style={{ ...S.card, padding: 20 }}>
        <div style={{ fontSize: 14, color: '#64748B' }}>Loading sickness data...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ ...S.card, padding: 20 }}>
        <div style={{ fontSize: 14, color: '#64748B' }}>No sickness data available</div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
          Upload staffing plans to track sickness
        </div>
      </div>
    );
  }

  const trendIcon = stats.trend === 'up' ? '📈' : stats.trend === 'down' ? '📉' : '➡️';
  const trendColor = stats.trend === 'up' ? '#EF4444' : stats.trend === 'down' ? '#10B981' : '#64748B';
  const rateColor = parseFloat(stats.rate) > 5 ? '#EF4444' : '#10B981';

  return (
    <div style={{ ...S.card, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            🏥 Department Sickness Rate
          </h3>
          <div style={{ fontSize: 11, color: '#64748B' }}>Last 6 weeks</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: rateColor, lineHeight: 1 }}>
            {stats.rate}%
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
        {stats.totalSickDays} sick days / {stats.totalWorkDays} total days
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
        <span style={{ color: trendColor }}>{trendIcon}</span>
        <span style={{ color: trendColor }}>
          {stats.trend === 'up' ? 'Increasing' : stats.trend === 'down' ? 'Decreasing' : 'Stable'}
        </span>
        <span style={{ color: '#94A3B8' }}>vs previous 3 weeks</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN APP — LANDING + SHIFT WORKSPACE
   ═══════════════════════════════════════════════════ */
export default function App() {
  const [activeShift, setActiveShift] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const hasOnboarded = localStorage.getItem('hasCompletedOnboarding');
    return !hasOnboarded; // Show if user hasn't completed onboarding
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const completeOnboarding = () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    setShowOnboarding(false);
  };

  const skipOnboarding = () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    setShowOnboarding(false);
  };

  const [loaded, setLoaded] = useState(false);

  // Shared state
  const [machineStatus, setMachineStatus] = useState({});
  const [planProducts, setPlanProducts] = useState(PLAN_PRODUCTS);
  const [areas, setAreas] = useState(INIT_AREAS);
  const [lines] = useState(INIT_LINES);
  const [loadingData, setLoadingData] = useState([]); // TMS loading plan data
  const [staffingPlan, setStaffingPlan] = useState(null); // Weekly staffing XLSX data

  // Load shared data on mount
  useEffect(() => {
    (async () => {
      const ms = await sGet("shared:machineStatus");
      if (ms) setMachineStatus(ms);
      const pp = await sGet("shared:planProducts");
      if (pp) setPlanProducts(pp);
      // Areas always from INIT_AREAS — skip stale storage
      const ld = await sGet("shared:loadingData");
      if (ld) setLoadingData(ld);
      const sp = await sGet("shared:staffingPlan");
      if (sp) setStaffingPlan(sp);
      setLoaded(true);
    })();
  }, []);

  // Save shared data on change
  useEffect(() => { if (loaded) { sSet("shared:machineStatus", machineStatus) } }, [machineStatus, loaded]);
  useEffect(() => { if (loaded) { sSet("shared:planProducts", planProducts) } }, [planProducts, loaded]);
  useEffect(() => { if (loaded) { sSet("shared:loadingData", loadingData) } }, [loadingData, loaded]);
  useEffect(() => { if (loaded && staffingPlan) { sSet("shared:staffingPlan", staffingPlan) } }, [staffingPlan, loaded]);

  if (!loaded) return <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#0B0E14", color: "#E2E8F0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 18, color: "#64748B" }}>Loading...</div></div>;

  if (!activeShift) return <Landing shifts={SHIFTS} onSelect={setActiveShift} machineStatus={machineStatus} loadingData={loadingData} staffingPlan={staffingPlan} setStaffingPlan={setStaffingPlan} theme={theme} setTheme={setTheme} />;

  return <ShiftWorkspace
    shift={activeShift}
    onBack={() => setActiveShift(null)}
    {...{ areas, setAreas, lines, machineStatus, setMachineStatus, planProducts, setPlanProducts, loadingData, setLoadingData, staffingPlan, setStaffingPlan, theme, setTheme }}
  />;
}

/* ═══════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════ */
function Landing({ shifts, onSelect, machineStatus, loadingData, staffingPlan, setStaffingPlan, theme, setTheme }) {
  const today = new Date();
  const runningToday = Object.values(machineStatus[fmt(today)] || {}).filter(v => v !== false).length;
  const todayLoads = loadingData.filter(r => r.date === fmt(today)).length;
  const [spLog, setSpLog] = useState([]);
  const [spUploading, setSpUploading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isMobile = useIsMobile();

  const SHIFT_HEADERS = ["A", "B", "C", "D"];
  const STATUS_CODES = new Set(["D", "N", "H", "S", "10M", "B", "RO", "TOIL", "U", "DISDAM", "PD-DAYS", "PD-NIGHTS"]);

  const handleStaffingUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSpUploading(true);
    setSpLog([`Processing ${files.length} file(s)...`]);

    const allLogs = [];
    let processedCount = 0;
    let latestPlan = null;

    for (const file of files) {
      try {
        allLogs.push(`\n📁 Processing: ${file.name}`);
        setSpLog([...allLogs, `⏳ ${processedCount + 1}/${files.length} files processed`]);

        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const log = [];

        // Helper: try to parse a cell as a date string
        const tryDate = (v) => {
          if (!v) return null;
          if (v instanceof Date) return fmt(v);
          if (typeof v === "number") { return fmt(new Date(Math.round((v - 25569) * 86400000))) }
          const s = String(v).trim();
          // Try ISO-ish: "2026-02-08" or "2026-02-08T00:00:00..."
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (m) return `${m[1]}-${m[2]}-${m[3]}`;
          return null;
        };

        // Parse FTE tab
        const fteSheet = wb.Sheets["FTE"] || wb.Sheets["fte"];
        if (!fteSheet) {
          allLogs.push(`  ✕ No 'FTE' tab found in ${file.name}`);
          continue;
        }
        const fteRows = XLSX.utils.sheet_to_json(fteSheet, { header: 1, defval: "" });
        log.push(`FTE tab: ${fteRows.length} rows`);

        // Extract dates from row 2 (index 1), columns 2-15
        const dateRow = fteRows[1] || [];
        const dates = []; const dateCols = [];
        for (let c = 2; c < 16; c++) {
          const d = tryDate(dateRow[c]);
          if (d) { dates.push(d); dateCols.push(c) }
        }
        if (dates.length === 0) {
          allLogs.push(`  ✕ No dates found in ${file.name}`);
          continue;
        }
        log.push(`Dates: ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} days)`);

        // Parse operators by shift
        const fte = { A: [], B: [], C: [], D: [] };
        let currentShift = null;
        for (let r = 2; r < fteRows.length; r++) {
          const row = fteRows[r];
          const colA = String(row[0] || "").trim();
          const colB = String(row[1] || "").trim();
          // Detect shift header (e.g. "A SHIFT" or "SHIFT A")
          const shiftMatch = colA.match(/^([ABCD])\s*SHIFT/i) || colA.match(/^SHIFT\s+([ABCD])/i);
          if (shiftMatch) { currentShift = shiftMatch[1].toUpperCase(); continue }
          // Stop at ASRS or non-shift sections
          if (/^(ASRS|FLC|TOTAL)/i.test(colA)) { currentShift = null; continue }
          if (!currentShift) continue;
          const name = colA.replace(/\s*-\s*LT$/, "").trim();
          if (!name || /^(TOTAL|$)/i.test(name)) continue;
          const position = colB.toUpperCase().replace(/\s/g, "");
          const days = {};
          dateCols.forEach((c, i) => {
            const v = String(row[c] || "").trim().toUpperCase();
            if (v && STATUS_CODES.has(v)) days[dates[i]] = v;
          });
          // Include operator if they have a name (even if all days are blank = off pattern week)
          fte[currentShift].push({ name, position, days });
        }
        log.push(`FTE: A=${fte.A.length}, B=${fte.B.length}, C=${fte.C.length}, D=${fte.D.length}`);

        // Parse AGENCY tab
        const agSheet = wb.Sheets["AGENCY"] || wb.Sheets["Agency"] || wb.Sheets["agency"];
        const agency = [];
        if (agSheet) {
          const agRows = XLSX.utils.sheet_to_json(agSheet, { header: 1, defval: "" });
          const agDateRow = agRows[0] || [];
          const agDates = []; const agDateCols = [];
          for (let c = 2; c < 16; c++) {
            const d = tryDate(agDateRow[c]);
            if (d) { agDates.push(d); agDateCols.push(c) }
          }
          for (let r = 3; r < agRows.length; r++) {
            const row = agRows[r];
            const name = String(row[0] || "").trim();
            const type = String(row[1] || "").trim();
            if (!name || /^(TOTAL|$)/i.test(name)) continue;
            const days = {};
            agDateCols.forEach((c, i) => {
              const v = String(row[c] || "").trim().toUpperCase();
              if (v && (STATUS_CODES.has(v) || v === "D" || v === "N")) days[agDates[i]] = v;
            });
            if (Object.keys(days).length > 0) { agency.push({ name, type, days }) }
          }
          log.push(`Agency: ${agency.length} workers`);
        }

        // Create plan object
        const plan = { week: dates[0], dates, fte, agency };
        const weekDate = dates[0];

        // Always set staffing plan to the most recent week uploaded
        if (!latestPlan || weekDate > latestPlan.week) {
          latestPlan = plan;
        }

        // Try to save to database (graceful - won't block if tables don't exist)
        try {
          await saveStaffingPlan(weekDate, plan);
        } catch (dbErr) {
          log.push(`⚠ DB save skipped (run migrations first)`);
        }

        // Extract and save sickness data
        const sicknessRecords = extractSicknessFromPlan(plan, weekDate);
        if (sicknessRecords.length > 0) {
          try {
            await saveSicknessRecords(sicknessRecords);
            log.push(`✓ Saved ${sicknessRecords.length} sickness records`);
          } catch (dbErr) {
            log.push(`⚠ Sickness DB save skipped (run migrations first)`);
          }
        }

        log.push(`✓ Parsed successfully (Week ${weekDate})`);
        allLogs.push(`  ✓ ${file.name} - Week ${weekDate} (FTE: ${fte.A.length + fte.B.length + fte.C.length + fte.D.length} ops)`);
        processedCount++;

      } catch (err) {
        allLogs.push(`  ✕ ${file.name}: ${err.message}`);
      }
    }

    allLogs.push(`\n✓ Completed: ${processedCount}/${files.length} files processed successfully`);
    if (latestPlan) {
      setStaffingPlan(latestPlan);
      allLogs.push(`📋 Active plan set to Week ${latestPlan.week}`);
    }
    setSpLog(allLogs);
    setSpUploading(false);
    e.target.value = "";
  };

  // Helper function to extract sickness data from staffing plan
  const extractSicknessFromPlan = (plan, weekDate) => {
    const records = [];
    const shifts = ['A', 'B', 'C', 'D'];

    shifts.forEach(shiftId => {
      const operators = plan.fte[shiftId] || [];
      operators.forEach(op => {
        let sickDays = 0;
        Object.values(op.days || {}).forEach(status => {
          if (status === 'S' || status === 'SICK') {
            sickDays++;
          }
        });

        if (sickDays > 0) {
          records.push({
            operator_id: `${shiftId.toLowerCase()}_${op.name.toLowerCase().replace(/\s+/g, '_')}`,
            shift_id: shiftId.toLowerCase(),
            week_date: weekDate,
            days_sick: sickDays
          });
        }
      });
    });

    return records;
  };

  return (
    <div style={{ fontFamily: "'Satoshi','Roboto',sans-serif", background: "var(--bg-body)", color: "var(--text-primary)", minHeight: "100vh", transition: "background 0.3s, color 0.3s" }}>
      <link href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,301,701,300,501,401,901,400&display=swap" rel="stylesheet" />
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} style={{ ...S.bg, padding: 10, borderRadius: "50%" }}>
          {theme === 'light' ? <Ic.Moon /> : <Ic.Sun />}
        </button>
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: "linear-gradient(135deg,#E5B611,#C39B0E)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, color: "#000", margin: "0 auto 20px" }}>ML</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px" }}><span style={{ color: "#E5B611" }}>Magor</span> Logistics Management System</h1>
        <p style={{ color: "#64748B", fontSize: 14, margin: "0 0 8px" }}>4-on 4-off Continental · SKAP Training · Line Management</p>
        <button onClick={() => setShowHelp(true)} style={{ ...S.bg, fontSize: 12, padding: "6px 16px", margin: "0 auto 32px", display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.1)", color: "#F59E0B", borderColor: "rgba(245,158,11,0.2)" }}>📖 How to Use</button>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 16, maxWidth: 700, margin: "0 auto 40px" }}>
          {shifts.map(s => {
            const anchor = parse(s.anchor);
            const todayType = stype(anchor, today);
            // Calculate weekly hours from staffing plan (FTE only for this shift)
            const sk = s.id.replace(/^t/i, "").toUpperCase();
            const spOps = staffingPlan?.fte?.[sk] || [];
            const spDates = staffingPlan?.dates || [];
            let plannedShifts = 0, holShifts = 0, sickShifts = 0;
            if (spOps.length && spDates.length) {
              spOps.forEach(op => {
                spDates.forEach(ds => {
                  const st = op.days[ds];
                  if (st === "D" || st === "N" || st === "DISDAM" || st === "PD-DAYS" || st === "PD-NIGHTS") plannedShifts++;
                  else if (st === "H") holShifts++;
                  else if (st === "S") sickShifts++;
                });
              });
            }
            const plannedHrs = plannedShifts * 12;
            const holHrs = holShifts * 12;
            const sickHrs = sickShifts * 12;
            const hasStaffing = spOps.length > 0 && spDates.length > 0;
            return (
              <button key={s.id} onClick={() => onSelect(s)} style={{
                ...S.card, padding: 0, overflow: "hidden", cursor: "pointer", border: `2px solid ${s.color}33`,
                background: `linear-gradient(135deg,${s.color}08,${s.color}03)`,
                transition: "all 0.2s", textAlign: "left", fontFamily: "inherit", color: "#E2E8F0",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${s.color}33`; e.currentTarget.style.transform = "none" }}
              >
                <div style={{ padding: "24px 24px 12px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: `${s.color}22`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: s.color }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B", fontFamily: "'JetBrains Mono',monospace" }}>FLM: {s.flm}</div>
                  </div>
                </div>
                <div style={{ padding: "0 24px 8px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ ...S.chip(todayType === "off" ? "#64748B" : todayType === "day" ? "#F59E0B" : "#818CF8"), fontSize: 10 }}>
                    Today: {todayType === "day" ? "DAY SHIFT" : todayType === "night" ? "NIGHT SHIFT" : "OFF"}
                  </span>
                  <span style={{ ...S.chip("#64748B"), fontSize: 10 }}>{(SHIFT_OPS[s.id] || []).length} ops</span>
                </div>
                {hasStaffing && <div style={{ padding: "0 24px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(16,185,129,0.12)", color: "#10B981" }}>⏱ {plannedHrs}h planned</span>
                  {holHrs > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>🏖 {holHrs}h holiday</span>}
                  {sickHrs > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>🤒 {sickHrs}h sick</span>}
                </div>}
              </button>
            );
          })}
        </div>

        {/* Weekly Hours Totals */}
        {staffingPlan?.fte && staffingPlan?.dates?.length > 0 && (() => {
          let totPlanned = 0, totHol = 0, totSick = 0, agPlanned = 0, agHol = 0, agSick = 0;
          ["A", "B", "C", "D"].forEach(sk => {
            const spOps = staffingPlan.fte[sk] || [];
            spOps.forEach(op => {
              staffingPlan.dates.forEach(ds => {
                const st = op.days[ds];
                if (st === "D" || st === "N" || st === "DISDAM" || st === "PD-DAYS" || st === "PD-NIGHTS") totPlanned++;
                else if (st === "H") totHol++;
                else if (st === "S") totSick++;
              });
            });
          });
          (staffingPlan.agency || []).forEach(op => {
            staffingPlan.dates.forEach(ds => {
              const st = op.days[ds];
              if (st === "D" || st === "N" || st === "DISDAM" || st === "PD-DAYS" || st === "PD-NIGHTS") agPlanned++;
              else if (st === "H") agHol++;
              else if (st === "S") agSick++;
            });
          });
          const ftePH = totPlanned * 12, fteHH = totHol * 12, fteSH = totSick * 12;
          const agPH = agPlanned * 12;
          return <div style={{ ...S.card, maxWidth: 700, margin: "0 auto 16px", padding: 16, borderColor: "rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#8B5CF6", marginBottom: 8 }}>📊 Weekly Hours — All Shifts (WK {staffingPlan.week})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: agPH > 0 ? 10 : 0 }}>
              <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "rgba(16,185,129,0.08)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#10B981" }}>{ftePH.toLocaleString()}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>FTE Planned</div>
              </div>
              <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "rgba(245,158,11,0.08)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>{fteHH.toLocaleString()}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Holiday Hours</div>
              </div>
              <div style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.08)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#EF4444" }}>{fteSH.toLocaleString()}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Sick Hours</div>
              </div>
            </div>
            {agPH > 0 && <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>+ Agency: {agPH}h planned</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}>Grand Total: {(ftePH + agPH).toLocaleString()}h</span>
            </div>}
          </div>;
        })()}

        <div style={{ ...S.card, maxWidth: 700, margin: "0 auto", padding: 16, borderColor: "rgba(59,130,246,0.15)", background: "rgba(59,130,246,0.04)" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#3B82F6", marginBottom: 4 }}>Lines Today</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {INIT_LINES.map(l => {
              const running = l.machines.filter(m => (machineStatus[fmt(today)] || {})[m.id] !== false).length;
              return <span key={l.id} style={{ ...S.chip(running > 0 ? "#10B981" : "#EF4444"), fontSize: 11 }}>{l.name}: {running}/{l.machines.length}</span>;
            })}
            <span style={{ ...S.chip("#3B82F6"), fontSize: 11 }}>{runningToday}/7 machines</span>
            {todayLoads > 0 && <span style={{ ...S.chip("#A855F7"), fontSize: 11 }}>🚛 {todayLoads} loads today</span>}
          </div>
        </div>

        {/* Department Sickness Card */}
        <div style={{ maxWidth: 700, margin: "16px auto" }}>
          <DepartmentSicknessCard totalOperators={40} />
        </div>

        {/* Staffing Plan Upload */}
        <div style={{ ...S.card, maxWidth: 700, margin: "20px auto 0", padding: 16, borderColor: "rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#10B981" }}>📋 Weekly Staffing Plan</div>
            {staffingPlan && <span style={{ ...S.chip("#10B981"), fontSize: 10 }}>WK {staffingPlan.week} loaded</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ ...S.bp, background: "linear-gradient(135deg,#10B981,#059669)", fontSize: 11, padding: "6px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {spUploading ? "⏳ Parsing..." : "📁 Upload Staffing XLSX"}
              <input type="file" accept=".xlsx,.xls" onChange={handleStaffingUpload} disabled={spUploading} multiple style={{ display: "none" }} />
            </label>
            {staffingPlan && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["A", "B", "C", "D"].map(s => {
                const count = staffingPlan.fte[s]?.length || 0;
                const todayWorking = staffingPlan.fte[s]?.filter(op => { const st = op.days[fmt(today)]; return ["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(st) }).length || 0;
                return <span key={s} style={{ ...S.chip(SHIFTS.find(sh => sh.id === s.toLowerCase())?.color || "#64748B"), fontSize: 10 }}>{s}: {todayWorking}/{count}</span>;
              })}
              {staffingPlan.agency?.length > 0 && <span style={{ ...S.chip("#F59E0B"), fontSize: 10 }}>Agency: {staffingPlan.agency.filter(a => { const st = a.days[fmt(today)]; return ["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(st) }).length}/{staffingPlan.agency.length}</span>}
            </div>}
          </div>
          {spLog.length > 0 && <div style={{ marginTop: 8, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: 6, maxHeight: 100, overflowY: "auto" }}>
            {spLog.map((l, i) => <div key={i} style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: l.startsWith("✕") ? "#EF4444" : l.startsWith("✓") ? "#10B981" : "#94A3B8" }}>{l}</div>)}
          </div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   HELP / ONBOARDING GUIDE
   ═══════════════════════════════════════════════════ */
const HELP_SECTIONS = [
  { id: "welcome", icon: "👋", title: "Welcome", content: `Shift Rotar is a logistics management tool built for FLMs at Magor Brewery. It covers rota generation, handover, staffing, production lines, loading plans, and operator training.\n\nEach shift (A, B, C, D) has its own workspace with shared data across all shifts for things like line plans and loading.` },
  { id: "start", icon: "🚀", title: "Getting Started", content: `1. Upload your Weekly Staffing Plan (.xlsx) on the landing page — this tells the system who's working, on holiday, sick, or on 10M.\n\n2. Select your shift to enter the workspace.\n\n3. The tabs along the top give you access to everything:\n   • Rota — auto-generated shift assignments\n   • Handover — shift changeover document\n   • Staffing — view weekly staffing breakdown\n   • Lines — production line status\n   • Loading — TMS upload for load tracking\n   • Settings — manage operators, SKAP, training, holidays` },
  { id: "rota", icon: "📅", title: "Rota", content: `The rota auto-assigns operators to areas based on:\n   • Operator qualifications (set in Settings → Operators)\n   • Production line status (which machines are running)\n   • TMS loading data (how many loads per area)\n   • Staffing plan (who's available, off, sick, 10M)\n\nClick "Generate Rota" to create assignments for the current week. The system uses the 4-on 4-off continental pattern (2 days, 2 nights, 4 off).\n\nYou can navigate weeks with the arrows. Operators marked off in the staffing plan are automatically excluded.` },
  { id: "handover", icon: "🔄", title: "Handover", content: `The handover tab auto-detects your current and incoming shift based on today's date and time.\n\nIt shows:\n   • Staffing — who's working, on holiday, sick\n   • Loading status — completed, in progress, pending, waiting collection\n   • Production lines — what's running today and tomorrow\n   • Handover notes — categorised notes you can fill in\n   • AI Summary — generates a professional summary of everything\n\nPress "🖨️ Print Handover" to open a print-ready A4 view, then use Ctrl+P to print.` },
  { id: "loading", icon: "🚛", title: "Loading (TMS)", content: `Upload your TMS export (.xlsx) in the Loading tab. The system parses dock assignments, timestamps, and carrier info.\n\nLoad statuses for preloads:\n   • Pending — not started\n   • In Progress — load started, not finished\n   • Waiting Collection — loaded but no driver checked in/out\n   • Driver Onsite — driver checked in, load done, awaiting checkout\n   • Complete — all 4 timestamps present\n\nThe office assignment in the rota is based on Magor 1 + Tents combined loads: 1 op if under 50, 2 if 50+. Keg loaders handle their own paperwork.` },
  { id: "lines", icon: "🏭", title: "Production Lines", content: `Upload production plan PDFs in the Lines tab — the system uses AI to parse which machines are running each day and extracts SKU codes.\n\nOr click "Load Feb 2026" for built-in sample data.\n\nYou can manually toggle any machine on/off by clicking the RUN/DOWN buttons — useful for ad-hoc breakdowns or changes.\n\nMachine mapping:\n   • MAGC2 = MAC2 (Can Line 2)\n   • MAGD1 = MAC1 (Can Line 1)\n   • MAGN3 = MAB1, MAGN4 = MAB2, MAGN5 = MAB3 (Bot Lines)\n   • MAGN6 = MAB4 (Corona)\n   • MAGKG = MAK1 (Keg Line)` },
  { id: "staffing", icon: "👥", title: "Staffing Plan", content: `Upload the weekly staffing XLSX on the landing page. It reads the FTE and Agency tabs.\n\nStatus codes:\n   • D = Day shift, N = Night shift\n   • H = Holiday, S = Sick\n   • 10M = 10-month (excluded from rota unless D or N)\n   • B = Bank holiday, RO = Rest off\n   • TOIL = Time off in lieu\n   • DISDAM = Displaced/DAM shift\n\nThe staffing data feeds into rota generation (availability), handover (staffing cards), and the AI summary.` },
  { id: "settings", icon: "⚙️", title: "Settings", content: `Settings contains four sub-tabs:\n\n👷 Operators — Add, remove, and set qualifications for each operator. Quals determine which areas they can be assigned to in the rota.\n\n📋 SKAP — 131 tasks across 6 levels (New Starter → MOP). Track completion per operator.\n\n📊 Training — Matrix view of operator progress across all areas.\n\n🏖️ Holidays — Book operator holidays. These are checked during rota generation to exclude unavailable operators.` },
];

function HelpModal({ onClose }) {
  const [activeSection, setActiveSection] = useState("welcome");
  const section = HELP_SECTIONS.find(s => s.id === activeSection) || HELP_SECTIONS[0];
  const curIdx = HELP_SECTIONS.findIndex(s => s.id === activeSection);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: "#111827", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", width: "90%", maxWidth: 750, maxHeight: "85vh", display: "flex", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div style={{ width: 200, background: "rgba(0,0,0,0.3)", padding: "20px 0", borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "0 16px 16px", fontWeight: 800, fontSize: 14, color: "#F59E0B" }}>📖 Help Guide</div>
          {HELP_SECTIONS.map(s => <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 16px", border: "none", background: activeSection === s.id ? "rgba(245,158,11,0.1)" : "transparent", color: activeSection === s.id ? "#F59E0B" : "#94A3B8", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: activeSection === s.id ? 700 : 500, textAlign: "left", transition: "all 0.15s" }}><span>{s.icon}</span><span>{s.title}</span></button>)}
        </div>
        {/* Content */}
        <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{section.icon}</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>{section.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#94A3B8", cursor: "pointer", borderRadius: 8, padding: "6px 10px", fontFamily: "inherit", fontSize: 14, fontWeight: 700 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: "#CBD5E1", whiteSpace: "pre-line" }}>{section.content}</div>
          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {curIdx > 0 ? <button onClick={() => setActiveSection(HELP_SECTIONS[curIdx - 1].id)} style={{ ...S.bg, fontSize: 12, padding: "6px 14px" }}>← {HELP_SECTIONS[curIdx - 1].title}</button> : <div />}
            {curIdx < HELP_SECTIONS.length - 1 ? <button onClick={() => setActiveSection(HELP_SECTIONS[curIdx + 1].id)} style={{ ...S.bp, background: "linear-gradient(135deg,#F59E0B,#D97706)", fontSize: 12, padding: "6px 14px" }}>{HELP_SECTIONS[curIdx + 1].title} →</button> : <button onClick={onClose} style={{ ...S.bp, background: "linear-gradient(135deg,#10B981,#059669)", fontSize: 12, padding: "6px 14px" }}>Got it! ✓</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROTA CONFIRMATION MODAL
   ═══════════════════════════════════════════════════ */
function RotaConfirmModal({ week, result, onConfirm, onCancel }) {
  if (!result) return null;

  const assignedCount = Object.keys(result.assigns).length;
  const areasCovered = new Set(Object.values(result.assigns)).size;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
      <div style={{ ...S.card, maxWidth: 600, width: "100%" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#10B981" }}>✓ Rota Generated Successfully</h3>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, marginBottom: 16, color: "var(--text-primary)" }}>
            Review the rota and confirm to save it to the database for tracking.
          </p>

          <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>Week</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>{fmt(week)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>Operators Assigned</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>{assignedCount}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>Areas Covered</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>{areasCovered}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>Warnings</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: result.warns.length > 0 ? "#F59E0B" : "#10B981" }}>
                  {result.warns.length > 0 ? result.warns.length : "None"}
                </div>
              </div>
            </div>
          </div>

          {result.warns.length > 0 && (
            <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 6 }}>⚠️ Warnings:</div>
              {result.warns.map((warn, i) => (
                <div key={i} style={{ fontSize: 11, color: "#F59E0B", marginLeft: 8 }}>• {warn}</div>
              ))}
            </div>
          )}

          <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 6, padding: 12 }}>
            <p style={{ fontSize: 12, color: "#3B82F6", marginBottom: 4 }}>
              <strong>What happens when you confirm:</strong>
            </p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              • Rota assignments will be saved to the database<br />
              • Operator work history will be updated<br />
              • This data will be used for rotation tracking and balance reports
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...S.bg, padding: "8px 16px", border: "1px solid var(--border-color)" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: "8px 20px", border: "none", background: "#10B981", color: "#fff", fontWeight: 600, borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
            ✓ Confirm & Save to Database
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CAN LINE CONFIRMATION MODAL
   ═══════════════════════════════════════════════════ */
function CanLineConfirmModal({ machinesDown, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
      <div style={{ ...S.card, maxWidth: 500, width: "100%" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#F59E0B" }}>⚠️ Can Line Staffing Adjustment</h3>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, marginBottom: 12, color: "var(--text-primary)" }}>
            The following can line machine(s) are marked as <strong style={{ color: "#EF4444" }}>DOWN</strong>:
          </p>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: 12, marginBottom: 12 }}>
            {machinesDown.map((machine, i) => (
              <div key={i} style={{ fontSize: 12, fontWeight: 600, color: "#EF4444" }}>
                • {machine}
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: 12 }}>
            <p style={{ fontSize: 12, color: "#F59E0B", marginBottom: 8 }}>
              <strong>Staffing Recommendation:</strong>
            </p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              • <strong>Normal:</strong> 4 operators on can line<br />
              • <strong>With machine down:</strong> 3 operators recommended
            </p>
          </div>
        </div>

        <p style={{ fontSize: 13, marginBottom: 20, color: "var(--text-secondary)" }}>
          Would you like to generate the rota with <strong>3 operators</strong> on the can line instead of 4?
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...S.bg, padding: "8px 16px", border: "1px solid var(--border-color)" }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(false)} style={{ ...S.bg, padding: "8px 16px", border: "1px solid #64748B", background: "rgba(100,116,139,0.1)" }}>
            Keep 4 Operators
          </button>
          <button onClick={() => onConfirm(true)} style={{ padding: "8px 16px", border: "none", background: "#F59E0B", color: "#000", fontWeight: 600, borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
            Use 3 Operators
          </button>
        </div>
      </div>
    </div>
  );
}

function ShiftWorkspace({ shift, onBack, areas, setAreas, lines, machineStatus, setMachineStatus, planProducts, setPlanProducts, loadingData, setLoadingData, staffingPlan, setStaffingPlan, theme, setTheme }) {
  console.log("ShiftWorkspace mounting", shift.id);
  const [tab, setTab] = useState("rota");
  const [loaded, setLoaded] = useState(false);

  // Shift-specific state
  const [ops, setOps] = useState([]);
  const [hols, setHols] = useState([]);
  const [training, setTraining] = useState({});
  const [allA, setAllA] = useState({});
  const [result, setResult] = useState(null);
  const [teamSettings, setTeamSettings] = useState({ name: shift.name, color: shift.color, anchor: shift.anchor, flm: shift.flm });
  const [week, setWeek] = useState(ws(new Date()));
  const [rotationHistory, setRotationHistory] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const isMobile = useIsMobile();

  const sk = `shift:${shift.id}`;

  // Load shift data on mount
  useEffect(() => {
    (async () => {
      console.log("ShiftWorkspace effect start");
      const o = await sGet(`${sk}:ops`);
      console.log("ShiftWorkspace ops loaded", o?.length);
      setOps(o || (SHIFT_OPS[shift.id] || []));
      const h = await sGet(`${sk}:hols`); if (h) setHols(h);
      const t = await sGet(`${sk}:training`); if (t) setTraining(t);
      // Skip loading old assigns — may have been generated with wrong anchors
      const ts = await sGet(`${sk}:teamSettings`);
      if (ts) setTeamSettings({ ...ts, anchor: shift.anchor, flm: shift.flm });
      setLoaded(true);
      console.log("ShiftWorkspace setLoaded true");
    })();
  }, [sk, shift.id]);

  // Load rotation history from Supabase
  useEffect(() => {
    (async () => {
      if (!loaded) return;
      const { getAllRotationHistory } = await import('./utils/supabaseClient.js');
      const history = await getAllRotationHistory(12); // Last 12 weeks
      setRotationHistory(history);
    })();
  }, [loaded]);

  // Save shift data on change
  useEffect(() => { if (loaded) sSet(`${sk}:ops`, ops) }, [ops, loaded, sk]);
  useEffect(() => { if (loaded) sSet(`${sk}:hols`, hols) }, [hols, loaded, sk]);
  useEffect(() => { if (loaded) sSet(`${sk}:training`, training) }, [training, loaded, sk]);
  useEffect(() => { if (loaded) sSet(`${sk}:assigns`, allA) }, [allA, loaded, sk]);
  useEffect(() => { if (loaded) sSet(`${sk}:teamSettings`, teamSettings) }, [teamSettings, loaded, sk]);

  const team = { id: shift.id, ...teamSettings, anchor: shift.anchor };

  // Sync agency workers from staffing plan into ops list
  // Only import agency who have D or N on at least one day (exclude PD/DISDAM-only)
  useEffect(() => {
    if (!staffingPlan?.agency?.length || !loaded) return;
    const realAgency = staffingPlan.agency.filter(a => {
      return Object.values(a.days).some(st => st === "D" || st === "N");
    });
    const agencyNames = realAgency.map(a => a.name.toLowerCase().trim());
    const existingAgency = ops.filter(o => o.isAgency).map(o => o.name.toLowerCase().trim());
    const newAgency = realAgency.filter(a => !existingAgency.includes(a.name.toLowerCase().trim()));
    const removedAgency = ops.filter(o => o.isAgency && !agencyNames.includes(o.name.toLowerCase().trim()));
    if (newAgency.length || removedAgency.length) {
      setOps(prev => {
        let updated = prev.filter(o => !o.isAgency || agencyNames.includes(o.name.toLowerCase().trim()));
        newAgency.forEach(a => {
          updated.push({ id: `ag_${uid()}`, name: a.name, quals: ["tents"], isAgency: true });
        });
        return updated;
      });
    }
  }, [staffingPlan, loaded]);

  const gen = useCallback(() => {
    const r = genRota(ops, areas, lines, team, hols, week, allA, training, machineStatus, loadingData, staffingPlan, rotationHistory);
    setAllA(p => ({ ...p, ...r.assigns }));
    setResult(r);
    setShowConfirmModal(true); // Show confirmation modal instead of auto-saving
  }, [ops, areas, lines, team, hols, week, allA, training, machineStatus, loadingData, staffingPlan, rotationHistory]);

  const confirmRota = useCallback(() => {
    if (!result) return;

    // Save rotation history to Supabase
    const weekStr = fmt(week);
    saveWeekRotationHistory(weekStr, shift.id, result.assigns, ops);

    setShowConfirmModal(false);
  }, [result, week, shift.id, ops]);

  const wd = useMemo(() => Array.from({ length: 7 }, (_, i) => ad(week, i)), [week]);
  const tabs = [{ id: "rota", l: "Rota" }, { id: "handover", l: "🔄 Handover" }, { id: "staffing", l: "👥 Staffing" }, { id: "lines", l: "Lines" }, { id: "loading", l: "Loading" }, { id: "settings", l: "⚙️ Settings" }];
  const [settingsTab, setSettingsTab] = useState("operators");
  const [showHelp, setShowHelp] = useState(false);
  const settingsTabs = [{ id: "operators", l: "👷 Operators" }, { id: "skap", l: "📋 SKAP" }, { id: "training", l: "📊 Training" }, { id: "history", l: "📈 Work History" }, { id: "holidays", l: "🏖️ Holidays" }, { id: "sickness", l: "🏥 Sickness" }];

  if (!loaded) return <div style={{ fontFamily: "'Satoshi','Roboto',sans-serif", background: "var(--bg-body)", color: "var(--text-primary)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading {shift.name}...</div>;

  return (
    <div style={{ fontFamily: "'Satoshi','Roboto',sans-serif", background: "var(--bg-body)", color: "var(--text-primary)", minHeight: "100vh" }}>
      <link href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,301,701,300,501,401,901,400&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ background: "var(--bg-body)", borderBottom: `2px solid #E5B611`, padding: "10px 20px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, gap: isMobile ? 10 : 0, boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "space-between" : "flex-start" }}>
          <button onClick={onBack} style={{ ...S.bg, padding: "6px 10px", border: "none" }}><Ic.Back /></button>
          <div style={{ width: 34, height: 34, background: `${team.color}22`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: team.color }}>{shift.icon}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: team.color }}>{team.name}</div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>FLM: {shift.flm} · {ops.length} operators</div>
          </div>
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} style={{ ...S.bg, padding: 8, marginLeft: 8, borderRadius: "50%", background: "transparent", border: "1px solid var(--border-color)" }}>
            {theme === 'light' ? <Ic.Moon /> : <Ic.Sun />}
          </button>
        </div>
        <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, overflowX: "auto", alignItems: "center", maxWidth: isMobile ? "100%" : "auto", width: isMobile ? "100%" : "auto" }}>
          {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: tab === t.id ? `${team.color}22` : "transparent", color: tab === t.id ? team.color : "#94A3B8", cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>{t.l}</button>)}
          <button onClick={() => setShowHelp(true)} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "rgba(245,158,11,0.1)", color: "#F59E0B", cursor: "pointer", fontWeight: 800, fontSize: 13, fontFamily: "inherit", marginLeft: 4, flexShrink: 0 }} title="Help">?</button>
        </div>
      </header>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <main style={{ padding: 20, maxWidth: 1440, margin: "0 auto" }}>
        {tab === "rota" && <Rota {...{ week, setWeek, result, ops, areas, lines, team, hols, wd, gen, machineStatus, planProducts, loadingData }} />}
        {tab === "handover" && <HandoverView {...{ shift, team, ops, areas, lines, machineStatus, planProducts, loadingData, staffingPlan }} />}
        {tab === "staffing" && <StaffingView staffingPlan={staffingPlan} shiftId={shift.id} team={team} />}
        {tab === "lines" && <LinesView {...{ lines, machineStatus, setMachineStatus, wd, planProducts, setPlanProducts }} />}
        {tab === "loading" && <LoadingView {...{ loadingData, setLoadingData }} />}
        {tab === "settings" && <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4, width: "fit-content" }}>
            {settingsTabs.map(st => <button key={st.id} onClick={() => setSettingsTab(st.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: settingsTab === st.id ? `${team.color}18` : "transparent", color: settingsTab === st.id ? team.color : "#64748B", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit", transition: "all 0.15s" }}>{st.l}</button>)}
          </div>
          {settingsTab === "operators" && <Ops {...{ ops, setOps, team, training }} />}
          {settingsTab === "skap" && <Skap />}
          {settingsTab === "training" && <Training {...{ ops, training, setTraining, areas, rotationHistory }} />}
          {settingsTab === "history" && <OperatorWorkHistory {...{ ops, areas }} />}
          {settingsTab === "holidays" && <Hols {...{ hols, setHols, ops }} />}
          {settingsTab === "sickness" && <OperatorSicknessTable ops={ops} shiftId={shift.id} team={team} />}
        </div>}
      </main>
      {showConfirmModal && (
        <RotaConfirmModal
          week={week}
          result={result}
          onConfirm={confirmRota}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROTA VIEW
   ═══════════════════════════════════════════════════ */
function Rota({ week, setWeek, result, ops, areas, lines, team, hols, wd, gen, machineStatus, planProducts, loadingData }) {
  const [vm, setVm] = useState("area");
  const g = result?.grid || {}, w = result?.warns || [];
  const anchor = parse(team.anchor);

  // Compute area needs per day for display
  const areaInfo = (area, ds) => {
    if (area.type === "line") {
      const line = lines.find(l => l.id === area.lineId);
      if (!line) return { status: "—", need: 0 };
      const dayStatus = machineStatus[ds] || {};
      const running = line.machines.filter(m => dayStatus[m.id] !== false).length;
      const total = line.machines.length;
      if (!running) return { status: "DOWN", need: 0, color: "#EF4444" };
      // Keg inside/outside: each needs 1 op
      if (area.role) { return { status: "RUN", need: 1, color: "#10B981" } }
      const need = line.id === "canline" ? (running < total ? line.minOps : line.normalOps) : line.normalOps;
      return { status: `${running}/${total}`, need, color: "#10B981" };
    }
    if (area.type === "loading") {
      const st = stype(anchor, parse(ds));
      const shiftType = st === "day" ? "day" : st === "night" ? "night" : null;
      if (!shiftType) return { status: "OFF", need: 0, color: "#475569" };
      const loads = loadingData?.filter(r => r.date === ds && r.shift === shiftType && r.areaCode === area.tmsArea).length || 0;
      const need = loads ? Math.ceil(loads / LOADS_PER_OP) : area.min || 0;
      return { status: `${loads} loads`, need, color: loads ? "#3B82F6" : "#475569" };
    }
    if (area.type === "office") {
      // Office covers M1 + Tents only (keg handle their own)
      const st2 = stype(anchor, parse(ds));
      const sft = st2 === "day" ? "day" : st2 === "night" ? "night" : null;
      const m1 = sft ? loadingData?.filter(r => r.date === ds && r.shift === sft && r.areaCode === "MAGCAN").length || 0 : 0;
      const tn = sft ? loadingData?.filter(r => r.date === ds && r.shift === sft && r.areaCode === "MAGNEW").length || 0 : 0;
      const combined = m1 + tn;
      const need = Math.min(combined >= 50 ? 2 : 1, 2);
      return { status: `M1+T: ${combined}`, need, color: "#A855F7" };
    }
    if (area.type === "fixed") return { status: "Fixed", need: area.min || 1, color: "#64748B" };
    return { status: "—", need: area.min || 1, color: "#64748B" };
  };

  const AREA_TYPE_LABELS = { line: "Production", loading: "Loading", office: "Office", fixed: "Fixed" };
  const AREA_TYPE_COLORS = { line: "#10B981", loading: "#3B82F6", office: "#A855F7", fixed: "#64748B" };

  return (<div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setWeek(ad(week, -7))} style={{ ...S.bg, padding: "6px 8px" }}><Ic.Left /></button>
        <div><div style={{ fontWeight: 800, fontSize: 20 }}>{wl(week)}</div></div>
        <button onClick={() => setWeek(ad(week, 7))} style={{ ...S.bg, padding: "6px 8px" }}><Ic.Right /></button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2 }}>
          {["area", "team"].map(v => <button key={v} onClick={() => setVm(v)} style={{ ...S.bg, border: "none", padding: "5px 12px", background: vm === v ? "rgba(255,255,255,0.1)" : "transparent", color: vm === v ? "#E2E8F0" : "#64748B" }}>{v === "area" ? "By Area" : "By Operator"}</button>)}
        </div>
        <button onClick={gen} style={S.bp}><Ic.Shuffle /> Generate</button>
      </div>
    </div>
    {/* Cycle strip */}
    <div style={{ ...S.card, padding: "8px 14px", marginBottom: 12, borderLeft: `3px solid ${team.color}` }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: team.color, marginBottom: 4 }}>Cycle Pattern</div>
      <div style={{ display: "flex", gap: 2 }}>{wd.map((d, i) => { const s = stype(anchor, d); return <div key={i} style={{ flex: 1, textAlign: "center", borderRadius: 3, padding: "3px 0", background: s === "day" ? "#F59E0B33" : s === "night" ? "#6366F133" : "rgba(255,255,255,0.03)", fontSize: 10, fontWeight: 700, color: s === "day" ? "#F59E0B" : s === "night" ? "#818CF8" : "#334155" }}>{DAYS[i]} {d.getDate()}<br />{s === "day" ? "DAY" : s === "night" ? "NIGHT" : "OFF"}</div> })}</div>
    </div>
    {/* Staffing overview strip — all areas */}
    <div style={{ ...S.card, padding: "8px 14px", marginBottom: 12, borderColor: "rgba(59,130,246,0.15)" }}>
      <div style={{ fontWeight: 700, fontSize: 11, color: "#3B82F6", marginBottom: 6 }}>Staffing Requirements This Week</div>
      <div style={{ display: "grid", gridTemplateColumns: "120px repeat(7,1fr)", gap: 3, fontSize: 9 }}>
        <div style={{ fontWeight: 700, color: "#64748B" }}>Area</div>
        {wd.map((d, i) => <div key={i} style={{ textAlign: "center", fontWeight: 700, color: "#64748B" }}>{DAYS[i]}</div>)}
        {areas.map(area => <Fragment key={area.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: AREA_TYPE_COLORS[area.type], flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{area.name}</span>
          </div>
          {wd.map((d, i) => {
            const ds = fmt(d);
            const st = stype(anchor, d);
            if (st === "off") return <div key={i} style={{ textAlign: "center" }}><span style={{ fontSize: 8, color: "#334155" }}>OFF</span></div>;
            const info = areaInfo(area, ds);
            const assigned = Object.entries(g[ds] || {}).filter(([_, v]) => v.area === area.id).length;
            return <div key={i} style={{ textAlign: "center" }}>
              {area.type === "line" ?
                <span style={{ padding: "1px 4px", borderRadius: 3, fontWeight: 700, fontSize: 8, background: info.need > 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)", color: info.need > 0 ? "#10B981" : "#EF4444" }}>{info.need > 0 ? `${info.status}` : info.status}</span>
                : area.type === "loading" ?
                  <span style={{ padding: "1px 4px", borderRadius: 3, fontWeight: 700, fontSize: 8, background: info.need > 0 ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)", color: info.need > 0 ? "#3B82F6" : "#475569" }}>{info.status}</span>
                  : <span style={{ padding: "1px 4px", borderRadius: 3, fontWeight: 700, fontSize: 8, background: `${info.color}15`, color: info.color }}>{info.need}</span>}
              {result && <div style={{ fontSize: 7, color: assigned >= info.need ? "#10B981" : "#EF4444", fontWeight: 700 }}>{assigned}/{info.need}</div>}
            </div>;
          })}
        </Fragment>)}
      </div>
    </div>
    {w.length > 0 && <div style={{ ...S.card, background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", marginBottom: 12, padding: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444", fontWeight: 700, fontSize: 12 }}><Ic.Warn /> Warnings</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>{w.map((x, i) => <span key={i} style={{ ...S.chip("#EF4444"), fontSize: 10 }}>{x}</span>)}</div>
    </div>}
    <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch", paddingBottom: 10 }}>
      {!result ? <div style={{ ...S.card, textAlign: "center", padding: "50px 20px" }}><div style={{ fontSize: 40, marginBottom: 10 }}>📋</div><div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>No Rota Generated</div><button onClick={gen} style={{ ...S.bp, margin: "0 auto" }}><Ic.Shuffle /> Generate</button></div>
        : vm === "area" ? <AreaGrid g={g} wd={wd} areas={areas} ops={ops} areaInfo={areaInfo} anchor={anchor} /> : <OpGrid g={g} wd={wd} areas={areas} ops={ops} team={team} hols={hols} anchor={anchor} />}
    </div>
    {result && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
      {[{ l: "Scheduled", v: new Set(Object.values(g).flatMap(d => Object.keys(d))).size, c: "#3B82F6" }, { l: "Shift-Days", v: Object.values(g).reduce((s, d) => s + Object.keys(d).length, 0), c: "#10B981" }, { l: "Gaps", v: w.length, c: w.length ? "#EF4444" : "#10B981" }].map(s => <div key={s.l} style={{ ...S.card, textAlign: "center", padding: 12 }}><div style={{ fontSize: 24, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono',monospace" }}>{s.v}</div><div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>{s.l}</div></div>)}
    </div>}
  </div>);
}

const AREA_TYPE_COLORS_G = { line: "#10B981", loading: "#3B82F6", office: "#A855F7", fixed: "#64748B" };

function AreaGrid({ g, wd, areas, ops, areaInfo, anchor }) {
  return (<div style={{ overflowX: "auto" }}><div style={{ display: "grid", gridTemplateColumns: "140px repeat(7,1fr)", gap: 2, borderRadius: 8, overflow: "hidden" }}>
    <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 10px", fontWeight: 700, fontSize: 11, color: "#64748B" }}>Area</div>
    {wd.map((d, i) => <div key={i} style={{ background: fmt(d) === fmt(new Date()) ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.04)", padding: "6px 4px", textAlign: "center", fontWeight: 700, fontSize: 11, color: fmt(d) === fmt(new Date()) ? "#F59E0B" : "#64748B" }}>{DAYS[i]} {d.getDate()}</div>)}
    {areas.map((area, ai) => {
      const bg = ai % 2 ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.02)"; const tc = AREA_TYPE_COLORS_G[area.type] || "#64748B"; return <Fragment key={area.id}>
        <div style={{ background: bg, padding: "6px 10px", borderLeft: `3px solid ${tc}` }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{area.name}</div>
          <div style={{ fontSize: 8, fontWeight: 600, color: tc, textTransform: "uppercase" }}>{area.type === "line" ? "Production" : area.type === "loading" ? "Loading" : area.type === "office" ? "Office" : "Fixed"}</div>
        </div>
        {wd.map((d, di) => {
          const ds = fmt(d);
          const st = stype(anchor, d);
          const dd = g[ds] || {};
          const here = Object.entries(dd).filter(([_, v]) => v.area === area.id).map(([oid, v]) => ({ ...v, op: ops.find(o => o.id === oid) }));
          const info = areaInfo?.(area, ds);
          if (st === "off") return <div key={di} style={{ background: bg, padding: 4, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 9, color: "#334155" }}>OFF</span></div>;
          return <div key={di} style={{ background: bg, padding: 4, minHeight: 40, display: "flex", flexDirection: "column", gap: 2 }}>
            {info && info.need > 0 && <div style={{ fontSize: 7, fontWeight: 700, color: here.length >= info.need ? "#10B981" : "#F59E0B", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 1, marginBottom: 1 }}>
              {area.type === "line" ? `${info.status} machines` : area.type === "loading" ? info.status : `need ${info.need}`} · {here.length}/{info.need}
            </div>}
            {info && info.need === 0 && <span style={{ fontSize: 8, color: "#EF4444", fontWeight: 700, textAlign: "center" }}>DOWN</span>}
            {here.map(({ op, st: sh, tc: teamCol, isAgency: isAg }) => <div key={op?.id} style={{ fontSize: 9, fontWeight: 600, color: isAg ? "#F59E0B" : "#CBD5E1", background: `${teamCol}15`, borderRadius: 3, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2, borderLeft: `2px solid ${teamCol}` }}>{sh === "day" ? <Ic.Sun /> : <Ic.Moon />}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{op?.name?.split(" ").map((n, i) => i === 0 ? n[0] + "." : n).join(" ")}{isAg ? " ⓐ" : ""}</span></div>)}
          </div>
        })}
      </Fragment>
    })}
  </div></div>);
}

function OpGrid({ g, wd, areas, ops, team, hols, anchor }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "140px repeat(7,1fr)", gap: 2, borderRadius: 8, overflow: "hidden" }}>
    <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 10px", fontWeight: 700, fontSize: 10, color: "#64748B" }}>Operator</div>
    {wd.map((d, i) => { const s = stype(anchor, d); return <div key={i} style={{ background: s === "off" ? "rgba(255,255,255,0.02)" : s === "day" ? "rgba(245,158,11,0.06)" : "rgba(99,102,241,0.06)", padding: "6px 3px", textAlign: "center", fontWeight: 700, fontSize: 10, color: s === "off" ? "#334155" : s === "day" ? "#F59E0B" : "#818CF8" }}>{DAYS[i]} {d.getDate()}<div style={{ fontSize: 8, opacity: 0.7 }}>{s === "day" ? "DAY" : s === "night" ? "NIGHT" : "OFF"}</div></div> })}
    {ops.map((op, oi) => {
      const bg = oi % 2 ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.02)"; const opColor = op.isAgency ? "#F59E0B" : team.color; return <Fragment key={op.id}>
        <div style={{ background: bg, padding: "6px 10px", fontWeight: 600, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>{op.name}{op.isAgency && <span style={{ fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 2, background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>AG</span>}</div>
        {wd.map((d, di) => {
          const ds = fmt(d), s = stype(anchor, d), info = g[ds]?.[op.id], area = info ? areas.find(a => a.id === info.area) : null, hol = hols?.some(h => h.opId === op.id && ds >= h.start && ds <= h.end);
          const isOff = info?.off; const reason = info?.reason;
          return <div key={di} style={{ background: bg, padding: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {s === "off" ? <span style={{ fontSize: 9, color: "#334155" }}>OFF</span> : isOff ? <span style={{ fontSize: 9, color: "#EF4444", fontWeight: 700, background: "rgba(239,68,68,0.1)", borderRadius: 3, padding: "2px 6px" }}>{reason || "OFF"}</span> : hol ? <span style={{ fontSize: 9, color: "#EF4444", fontWeight: 700, background: "rgba(239,68,68,0.1)", borderRadius: 3, padding: "2px 6px" }}>HOL</span> : area ? <span style={{ fontSize: 9, fontWeight: 700, background: `${opColor}18`, color: opColor, borderRadius: 3, padding: "2px 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{area.name}</span> : <span style={{ fontSize: 9, color: "#475569" }}>—</span>}
          </div>
        })}
      </Fragment>
    })}
  </div>);
}

/* ═══════════════════════════════════════════════════
   HANDOVER VIEW
   ═══════════════════════════════════════════════════ */
function getNextShift(currentShiftId, date) {
  const today = typeof date === "string" ? parse(date) : date;
  const cur = SHIFTS.find(s => s.id === currentShiftId);
  if (!cur) return null;
  const curType = stype(parse(cur.anchor), today);
  if (curType === "day") {
    // Finishing days → night shift tonight
    return SHIFTS.find(s => s.id !== currentShiftId && stype(parse(s.anchor), today) === "night") || null;
  } else if (curType === "night") {
    // Finishing nights → day shift tomorrow
    const tmrw = ad(today, 1);
    return SHIFTS.find(s => s.id !== currentShiftId && stype(parse(s.anchor), tmrw) === "day") || null;
  }
  return null;
}

function getShiftOnDate(date, type) {
  const d = typeof date === "string" ? parse(date) : date;
  return SHIFTS.find(s => stype(parse(s.anchor), d) === type) || null;
}

function HandoverView({ shift, team, ops, areas, lines, machineStatus, planProducts, loadingData, staffingPlan }) {
  const today = new Date();
  const todayStr = fmt(today);
  const anchor = parse(team.anchor);
  const currentType = stype(anchor, today);
  const spKey = shift.id.replace(/^t/i, "").toUpperCase();

  // Staffing helpers
  const isWorking = s => ["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(s);
  const isDayShift = s => ["D", "DISDAM", "PD-DAYS"].includes(s);
  const isNightShift = s => ["N", "PD-NIGHTS"].includes(s);

  const getShiftStaffing = (shiftLetter, dateStr) => {
    const spOps = staffingPlan?.fte?.[shiftLetter] || [];
    if (!spOps.length) return null;
    const planDates = staffingPlan?.dates || [];
    const inPlan = planDates.includes(dateStr);

    if (inPlan) {
      // Exact staffing data available
      const working = spOps.filter(op => isWorking(op.days[dateStr]));
      const days = spOps.filter(op => isDayShift(op.days[dateStr]));
      const nights = spOps.filter(op => isNightShift(op.days[dateStr]));
      const hol = spOps.filter(op => ["H", "TOIL"].includes(op.days[dateStr]));
      const sick = spOps.filter(op => op.days[dateStr] === "S");
      const tenM = spOps.filter(op => op.days[dateStr] === "10M");
      const other = spOps.filter(op => { const s = op.days[dateStr]; return s && !isWorking(s) && !["H", "TOIL", "S", "10M"].includes(s) });
      return { total: spOps.length, working, days, nights, hol, sick, tenM, other, exact: true };
    } else {
      // Date outside plan — use rota pattern to estimate
      const sid = SHIFTS.find(s => s.id.replace(/^t/i, "").toUpperCase() === shiftLetter);
      if (!sid) return { total: spOps.length, working: spOps, days: spOps, nights: [], hol: [], sick: [], tenM: [], other: [], exact: false };
      const sAnchor = parse(sid.anchor);
      const dt = parse(dateStr);
      const st = stype(sAnchor, dt);
      if (st === "off") return { total: spOps.length, working: [], days: [], nights: [], hol: [], sick: [], tenM: [], other: [], exact: false };
      // On pattern — assume all available (no absence data for this date)
      const tenM = spOps.filter(op => {
        // Check if they're 10M on ANY plan date — they'd be 10M on this date too
        return Object.values(op.days).some(v => v === "10M");
      });
      const avail = spOps.filter(op => !Object.values(op.days).some(v => v === "10M"));
      return { total: spOps.length, working: avail, days: st === "day" ? avail : [], nights: st === "night" ? avail : [], hol: [], sick: [], tenM, other: [], exact: false };
    }
  };

  // State
  const [handoverDate, setHandoverDate] = useState(todayStr);
  const [overrideShift, setOverrideShift] = useState("");
  const [nextShiftLoads, setNextShiftLoads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState([]);
  const [notes, setNotes] = useState({ safety: "", equipment: "", staffing: "", operations: "", other: "" });
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  // Determine current/next shift
  const hDate = parse(handoverDate);
  const myType = stype(anchor, hDate);
  const autoNext = getNextShift(shift.id, hDate);
  const selectedNext = overrideShift ? SHIFTS.find(s => s.id === overrideShift) : autoNext;
  const nextType = selectedNext ? stype(parse(selectedNext.anchor), myType === "night" ? ad(hDate, 1) : hDate) : null;

  // Current shift's loads for handover date
  const myLoads = loadingData.filter(r => r.date === handoverDate && r.shift === myType);

  // Status logic per load
  const getLoadStatus = (r) => {
    const isPre = r.loadType === "PRE";
    if (isPre) {
      if (r.loadStart && r.loadEnd && !r.checkIn && !r.checkOut) return "waiting";    // Preloaded, waiting collection
      if (r.checkIn && r.loadStart && r.loadEnd && !r.checkOut) return "onsite";       // Driver arrived, not left yet
      if (r.checkIn && r.loadStart && r.loadEnd && r.checkOut) return "complete";      // All done
      if (r.loadStart && !r.loadEnd) return "inprogress";                          // Being loaded
      return "pending";                                                         // Not started
    }
    // Live/PU loads — original logic
    if (r.loadStart && r.loadEnd) return "complete";
    if (r.loadStart && !r.loadEnd) return "inprogress";
    return "pending";
  };
  myLoads.forEach(r => { r._status = getLoadStatus(r) });

  const completedLoads = myLoads.filter(r => r._status === "complete");
  const inProgressLoads = myLoads.filter(r => r._status === "inprogress");
  const pendingLoads = myLoads.filter(r => r._status === "pending");
  const waitingLoads = myLoads.filter(r => r._status === "waiting");
  const onsiteLoads = myLoads.filter(r => r._status === "onsite");
  const outstandingLoads = [...inProgressLoads, ...pendingLoads, ...waitingLoads, ...onsiteLoads];

  // Load counts by area
  const loadsByArea = (loads) => {
    const m = {};
    loads.forEach(r => { if (!m[r.areaCode]) m[r.areaCode] = { total: 0, pre: 0, liv: 0, inb: 0 }; m[r.areaCode].total++; if (r.loadType === "PRE") m[r.areaCode].pre++; else if (r.loadType === "LIV" || r.loadType === "PU") m[r.areaCode].liv++; else m[r.areaCode].inb++ });
    return m;
  };

  // Machine status for today + tomorrow
  const tomorrowStr = fmt(ad(hDate, 1));
  const todayMachines = machineStatus[handoverDate] || {};
  const tomorrowMachines = machineStatus[tomorrowStr] || {};

  // Upload handler for next shift TMS
  const handleNextShiftUpload = async (file) => {
    setUploading(true); setUploadLog(["⏳ Reading incoming shift TMS..."]);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: false, raw: true });
      const ws2 = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws2, { defval: null, raw: false });
      setUploadLog(p => [...p, `✓ Read ${rows.length} rows`]);
      const cols = Object.keys(rows[0] || {});
      const findCol = (hint) => cols.find(c => c.toLowerCase().includes(hint.toLowerCase())) || "";
      const cSlot = findCol("Start Date"), cCarrier = findCol("Carrier"), cLoadId = findCol("Load ID"), cExtId = findCol("External"), cDock = findCol("Dock ID"), cCheckIn = findCol("Check-In"), cLoadStart = findCol("Loading/Unloading Started"), cLoadEnd = findCol("Loading/Unloading Ended"), cCheckOut = findCol("Check-Out");
      const enriched = rows.map(r => {
        const dockId = String(r[cDock] || ""); const slotTime = String(r[cSlot] || "");
        const dock = parseDockId(dockId); const slot = parseSlotShift(slotTime);
        return { slotTime, carrier: String(r[cCarrier] || ""), loadId: String(r[cLoadId] || ""), externalId: String(r[cExtId] || ""), dockId, checkIn: r[cCheckIn] || null, loadStart: r[cLoadStart] || null, loadEnd: r[cLoadEnd] || null, checkOut: r[cCheckOut] || null, areaCode: dock.area, areaName: AREA_MAP[dock.area] || dock.area, loadType: normalizeLoadType(dock.type), dockNum: dock.dock, date: slot.date, shift: slot.shift, hour: slot.hour };
      }).filter(r => r.dockId && r.areaCode);
      setNextShiftLoads(enriched);
      setUploadLog(p => [...p, `✓ ${enriched.length} loads parsed for incoming shift`]);
    } catch (err) { setUploadLog(p => [...p, `✕ Error: ${err.message}`]) }
    setUploading(false);
  };

  // AI Summary generator
  const generateSummary = async () => {
    setAiLoading(true); setAiSummary("");
    try {
      // Build context object
      const outstandingByArea = loadsByArea(outstandingLoads);
      const nextByArea = loadsByArea(nextShiftLoads);
      const lineStatus = lines.map(l => {
        const running = l.machines.filter(m => todayMachines[m.id] !== false);
        const down = l.machines.filter(m => todayMachines[m.id] === false);
        const products = l.machines.filter(m => todayMachines[m.id] !== false && planProducts[handoverDate]?.[m.id]).map(m => ({ machine: m.id, product: planProducts[handoverDate][m.id] }));
        const tmrwRunning = l.machines.filter(m => tomorrowMachines[m.id] !== false).length;
        const tmrwDown = l.machines.filter(m => tomorrowMachines[m.id] === false).length;
        return { name: l.name, running: running.map(m => m.id), down: down.map(m => m.id), products, tomorrowRunning: tmrwRunning, tomorrowDown: tmrwDown };
      });

      const context = JSON.stringify({
        handoverDate: handoverDate,
        currentShift: { name: team.name, flm: team.flm, shiftType: myType, operatorCount: ops.length },
        incomingShift: selectedNext ? { name: selectedNext.name, flm: selectedNext.flm, shiftType: nextType, operatorCount: (SHIFT_OPS[selectedNext.id] || []).length } : null,
        staffing: (() => {
          const my = getShiftStaffing(spKey, handoverDate);
          const nk = selectedNext?.id?.replace(/^t/i, "").toUpperCase();
          const nd = myType === "night" ? fmt(ad(hDate, 1)) : handoverDate;
          const nx = nk ? getShiftStaffing(nk, nd) : null;
          return {
            currentShift: my ? { working: my.working.length, total: my.total, onHoliday: my.hol.map(o => o.name), sick: my.sick.map(o => o.name), tenMonth: my.tenM.map(o => o.name), days: my.days.length, nights: my.nights.length } : null,
            incomingShift: nx ? { working: nx.working.length, total: nx.total, onHoliday: nx.hol.map(o => o.name), sick: nx.sick.map(o => o.name), tenMonth: nx.tenM.map(o => o.name) } : null,
            agencyWorkingToday: staffingPlan?.agency?.filter(a => isWorking(a.days[handoverDate])).length || 0
          };
        })(),
        currentShiftLoads: { total: myLoads.length, completed: completedLoads.length, inProgress: inProgressLoads.length, pending: pendingLoads.length, waitingCollection: waitingLoads.length, driverOnsite: onsiteLoads.length, outstandingByArea },
        incomingShiftLoads: nextShiftLoads.length ? { total: nextShiftLoads.length, byArea: nextByArea } : null,
        productionLines: lineStatus,
        tomorrowDate: tomorrowStr,
        notes: Object.entries(notes).filter(([_, v]) => v.trim()).reduce((o, [k, v]) => ({ ...o, [k]: v }), {}),
      });

      const resp = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 2000,
          messages: [{
            role: "user", content: `You are generating a shift handover summary for a brewery logistics operation at Magor (AB InBev/Budweiser Brewing Group). Write a clear, concise, professional handover brief that the incoming FLM can read quickly.

Context data:
${context}

Guidelines:
- Start with a one-line headline summary of the shift state
- Use sections: STAFFING, LOADING STATUS, PRODUCTION LINES, KEY ACTIONS FOR INCOMING SHIFT, NOTES
- For staffing: mention how many operators are working vs total, who's on holiday/sick, how many agency. Highlight if the incoming shift is short-staffed
- For loading: mention outstanding loads by area, what's been completed, what's pending, and the incoming shift's workload if TMS data provided
- For production: which lines are running, what products, any changes expected tomorrow
- Keep it concise and actionable — this is read during a busy changeover
- Flag anything that needs immediate attention with ⚠️
- Use plain English, no jargon beyond what's standard at the brewery
- If notes are provided, incorporate them naturally
- Don't pad or waffle — every sentence should be useful
- End with a brief "good luck" or positive note referencing the incoming FLM by name if known
- Format with markdown-style bold for section headers`}]
        })
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      const text = data.content?.map(c => c.text || "").join("") || "No summary generated";
      setAiSummary(text);
    } catch (err) { setAiSummary(`Error generating summary: ${err.message}`) }
    setAiLoading(false);
  };

  const [waMsg, setWaMsg] = useState("");
  const [waCopied, setWaCopied] = useState(false);

  const generateWhatsApp = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    // Helper: get latest completed slot time for area+type
    const getLatestTime = (area, type) => {
      const areaLoads = myLoads.filter(r => r.areaCode === area && r.loadType === type);
      const completed = areaLoads.filter(r => r._status === "complete" || r._status === "waiting" || r._status === "onsite");
      const pending = areaLoads.filter(r => r._status === "pending" || r._status === "inprogress");
      if (!areaLoads.length) return "No loads scheduled";
      if (!completed.length) return "Not started";
      if (!pending.length) return "Complete ✅";
      // Find latest completed load's slot time
      const times = completed.map(r => r.slotTime).filter(Boolean).sort();
      const latest = times[times.length - 1] || "";
      // Extract just the time portion
      const tm = latest.match(/(\d{2}:\d{2})/);
      return tm ? `Up to ${tm[1]}` : `${completed.length}/${areaLoads.length} done`;
    };

    // Trailers: loads with checkIn but no checkOut (driver on site)
    const trailers = myLoads.filter(r => r._status === "onsite" || r._status === "waiting");
    const trailersByArea = {};
    trailers.forEach(r => {
      const a = r.areaName || r.areaCode;
      if (!trailersByArea[a]) trailersByArea[a] = 0;
      trailersByArea[a]++;
    });
    const trailerStr = trailers.length > 0
      ? Object.entries(trailersByArea).map(([a, c]) => `${a}: ${c}`).join(", ")
      : "None on site";

    // Tips: outstanding loads still to complete
    const outstanding = myLoads.filter(r => r._status === "pending" || r._status === "inprogress");
    const tipsByArea = {};
    outstanding.forEach(r => {
      const a = r.areaName || r.areaCode;
      if (!tipsByArea[a]) tipsByArea[a] = 0;
      tipsByArea[a]++;
    });
    const tipsStr = outstanding.length > 0
      ? Object.entries(tipsByArea).map(([a, c]) => `${a}: ${c} remaining`).join(", ")
      : "All clear ✅";

    const msg = `Magor update (${timeStr}):

Magor 1 pre - ${getLatestTime("MAGCAN", "PRE")}
Magor 1 live - ${getLatestTime("MAGCAN", "LIV")}
Tents pre - ${getLatestTime("MAGNEW", "PRE")}
Tents live - ${getLatestTime("MAGNEW", "LIV")}
Keg pre - ${getLatestTime("MAGKEG", "PRE")}
Trailers - ${trailerStr}
Tips - ${tipsStr}

${completedLoads.length}/${myLoads.length} loads complete | ${outstanding.length} outstanding`;

    setWaMsg(msg);
    setWaCopied(false);
  };

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(waMsg).then(() => { setWaCopied(true); setTimeout(() => setWaCopied(false), 3000) }).catch(() => { });
  };

  // Print/Export handover — build full HTML document
  const pNotes = Object.entries(notes).filter(([_, v]) => v.trim());
  const pNoteLabels = { safety: "Safety / Incidents", equipment: "Equipment / Breakdowns", staffing: "Staffing", operations: "Operations", other: "Other" };
  const pLines = lines.map(l => {
    const r = l.machines.filter(m => todayMachines[m.id] !== false);
    const d = l.machines.filter(m => todayMachines[m.id] === false);
    const pr = r.filter(m => planProducts[handoverDate]?.[m.id]).map(m => ({ id: m.id, p: planProducts[handoverDate][m.id] }));
    const tr = l.machines.filter(m => tomorrowMachines[m.id] !== false).length;
    const td2 = l.machines.filter(m => tomorrowMachines[m.id] === false).map(m => m.id);
    return { name: l.name, run: r.length, tot: l.machines.length, down: d.map(m => m.id), pr, tr, tt: l.machines.length, td2 };
  });
  const AC2 = { "MAGCAN": "#d97706", "MAGNEW": "#2563eb", "MAGKEG": "#059669" };


  // Build complete HTML for the handover document (used in print view as inline JSX)
  const getStaffingForPrint = () => {
    const myS = getShiftStaffing(spKey, handoverDate);
    const nk2 = selectedNext?.id?.replace(/^t/i, "").toUpperCase();
    const nd2 = myType === "night" ? fmt(ad(hDate, 1)) : handoverDate;
    const nxS = nk2 ? getShiftStaffing(nk2, nd2) : null;
    const agToday = staffingPlan?.agency?.filter(a => ["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(a.days[handoverDate])) || [];
    return { myS, nxS, agToday };
  };

  const printHandover = () => setShowPrint(true);


  // Render helpers
  const StatusBadge = ({ count, label, color }) => (
    <div style={{ ...S.card, padding: 12, textAlign: "center", borderColor: `${color}33`, background: `${color}06` }}>
      <div style={{ fontWeight: 800, fontSize: 28, color, fontFamily: "'JetBrains Mono',monospace" }}>{count}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>{label}</div>
    </div>
  );


  // PRINT VIEW — A4 document with @media print styles
  if (showPrint) {
    const { myS, nxS, agToday } = getStaffingForPrint();
    const P = { sc: { marginBottom: 12 }, sct: { fontSize: "9.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1.5px solid #ccc", paddingBottom: 2, marginBottom: 6, color: "#333" }, g4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 8 }, g3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, marginBottom: 6 }, g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }, stb: { textAlign: "center", padding: "5px 2px", border: "1.5px solid #e0e0e0", borderRadius: 4 }, ab: (c) => ({ padding: "5px 7px", border: "1px solid #e0e0e0", borderRadius: 4, borderLeft: `3px solid ${c}` }), lr: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 6px", border: "1px solid #e0e0e0", borderRadius: 4, marginBottom: 2, fontSize: "8.5pt" }, tg: (bg, fg) => ({ display: "inline-block", padding: "1px 5px", borderRadius: 3, fontSize: "7pt", fontWeight: 600, background: bg, color: fg }), nb: { padding: "5px 7px", border: "1px solid #e0e0e0", borderRadius: 4, marginBottom: 4 }, pr2: { fontSize: "7pt", color: "#777", margin: "-1px 0 2px 6px" } };
    return (<div>
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          .no-print{display:none!important}
          body,html{background:#fff!important;margin:0!important;padding:0!important}
          @page{size:A4;margin:12mm 14mm}
          .print-doc{box-shadow:none!important;border:none!important;margin:0!important;padding:0!important;max-width:100%!important}
        }
      `}} />
      <div className="no-print" style={{ background: "#0B0E14", padding: "12px 20px", display: "flex", gap: 10, justifyContent: "center", alignItems: "center", fontFamily: "'DM Sans',sans-serif" }}>
        <button onClick={() => setShowPrint(false)} style={{ ...S.bg, fontSize: 13, padding: "8px 16px" }}>← Back</button>
        <div style={{ color: "#F59E0B", fontWeight: 700, fontSize: 13 }}>🖨️ Press Ctrl+P (or ⌘+P on Mac) to print this page</div>
      </div>
      <div className="print-doc" style={{ maxWidth: 820, margin: "20px auto", background: "#fff", color: "#1a1a1a", padding: "28px 36px", borderRadius: 12, fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif", fontSize: "9.5pt", lineHeight: 1.4, boxShadow: "0 2px 20px rgba(0,0,0,0.3)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1a1a1a", paddingBottom: 10, marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12pt", fontWeight: 700 }}><span style={{ color: "#b45309" }}>{team.name}</span><span style={{ color: "#999", fontSize: "9pt" }}>→</span><span style={{ color: "#1d4ed8" }}>{selectedNext?.name || "—"}</span></div>
            <div style={{ fontSize: "17pt", fontWeight: 800, letterSpacing: -0.5, marginTop: 2 }}>Shift Handover</div>
          </div>
          <div style={{ textAlign: "right", fontSize: "8pt", color: "#555" }}><div><b style={{ color: "#1a1a1a", fontSize: "9pt" }}>{handoverDate}</b></div><div>{team.flm} ({myType === "day" ? "Days" : "Nights"}) → {selectedNext?.flm || "—"} ({nextType === "day" ? "Days" : "Nights"})</div><div>Magor Brewery — Logistics</div></div>
        </div>
        {/* Staffing */}
        {(myS || nxS) && <div style={P.sc}><div style={P.sct}>Staffing</div>
          <div style={P.g2}>
            {myS && <div style={{ padding: "5px 7px", border: "1px solid #e0e0e0", borderRadius: 4 }}>
              <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#b45309", marginBottom: 2 }}>{team.name}</div>
              <div style={{ fontSize: "14pt", fontWeight: 800, color: "#059669" }}>{myS.working.length} <span style={{ fontSize: "8.5pt", fontWeight: 600, color: "#777" }}>/ {myS.total} working</span></div>
              <div style={{ fontSize: "7pt", color: "#777", marginTop: 1 }}>
                {myS.days.length} days · {myS.nights.length} nights
                {agToday.length > 0 && <span> · +{agToday.length} agency</span>}
                {myS.hol.length > 0 && <span> · {myS.hol.length} hol ({myS.hol.map(o => o.name.split(" ")[0]).join(", ")})</span>}
                {myS.sick.length > 0 && <span> · {myS.sick.length} sick ({myS.sick.map(o => o.name.split(" ")[0]).join(", ")})</span>}
                {myS.tenM.length > 0 && <span> · {myS.tenM.length} 10M</span>}
              </div>
            </div>}
            {nxS && <div style={{ padding: "5px 7px", border: "1px solid #e0e0e0", borderRadius: 4 }}>
              <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#1d4ed8", marginBottom: 2 }}>{selectedNext?.name || "—"}</div>
              <div style={{ fontSize: "14pt", fontWeight: 800, color: "#059669" }}>{nxS.working.length} <span style={{ fontSize: "8.5pt", fontWeight: 600, color: "#777" }}>/ {nxS.total} working</span></div>
              <div style={{ fontSize: "7pt", color: "#777", marginTop: 1 }}>
                {nxS.hol.length > 0 && <span>{nxS.hol.length} hol · </span>}
                {nxS.sick.length > 0 && <span>{nxS.sick.length} sick · </span>}
                {nxS.tenM.length > 0 && <span>{nxS.tenM.length} 10M</span>}
              </div>
            </div>}
          </div>
        </div>}
        {/* Loading Status */}
        <div style={P.sc}><div style={P.sct}>Loading Status — {team.name}</div>
          <div style={P.g4}>
            {[{ n: myLoads.length, l: "Total Loads", c: "#2563eb" }, { n: completedLoads.length, l: "Completed", c: "#059669" }, { n: inProgressLoads.length, l: "In Progress", c: "#d97706" }, { n: pendingLoads.length, l: "Pending", c: "#dc2626" }].map(s => <div key={s.l} style={P.stb}><div style={{ fontSize: "16pt", fontWeight: 800, lineHeight: 1, color: s.c }}>{s.n}</div><div style={{ fontSize: "6.5pt", textTransform: "uppercase", fontWeight: 600, color: "#777" }}>{s.l}</div></div>)}
          </div>
          {outstandingLoads.length > 0 ? <>
            <div style={P.g3}>{Object.entries(AREA_MAP).map(([code, name]) => { const al = outstandingLoads.filter(r => r.areaCode === code); return <div key={code} style={P.ab(AC2[code] || "#999")}><div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: 0.5, color: "#555", fontWeight: 700 }}>{name}</div><div style={{ fontSize: "13pt", fontWeight: 800, color: AC2[code] || "#333" }}>{al.length}</div><div style={{ fontSize: "7pt", color: "#777" }}>{al.filter(r => r._status === "inprogress").length} in prog · {al.filter(r => r._status === "pending").length} pending · {al.filter(r => r._status === "waiting").length} waiting</div></div> })}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt", marginTop: 3 }}><thead><tr>{["Load ID", "Area", "Carrier", "Type", "Status"].map(h2 => <th key={h2} style={{ textAlign: "left", fontWeight: 700, fontSize: "7pt", textTransform: "uppercase", color: "#777", padding: "2px 4px", borderBottom: "1.5px solid #ddd" }}>{h2}</th>)}</tr></thead>
              <tbody>{outstandingLoads.map(r => { const stl = { inprogress: ["#fef3c7", "#92400e", "In Progress"], pending: ["#fee2e2", "#991b1b", "Pending"], waiting: ["#ede9fe", "#5b21b6", "Waiting Collection"], onsite: ["#e0f2fe", "#0369a1", "Driver Onsite"] }[r._status] || ["#fee2e2", "#991b1b", "Pending"]; return <tr key={r.loadId}><td style={{ padding: "2px 4px", borderBottom: "1px solid #f0f0f0", fontFamily: "monospace" }}>{r.loadId}</td><td style={{ padding: "2px 4px", borderBottom: "1px solid #f0f0f0" }}>{r.areaName}</td><td style={{ padding: "2px 4px", borderBottom: "1px solid #f0f0f0" }}>{r.carrier}</td><td style={{ padding: "2px 4px", borderBottom: "1px solid #f0f0f0" }}><span style={P.tg(r.loadType === "PRE" ? "#ede9fe" : "#fef3c7", r.loadType === "PRE" ? "#5b21b6" : "#92400e")}>{TYPE_LABELS[r.loadType] || r.loadType}</span></td><td style={{ padding: "2px 4px", borderBottom: "1px solid #f0f0f0" }}><span style={P.tg(stl[0], stl[1])}>{stl[2]}</span></td></tr> })}</tbody></table>
          </> : <div style={{ color: "#059669", fontWeight: 600 }}>✅ All loads completed — nothing outstanding.</div>}
        </div>
        {/* Incoming Shift */}
        {nextShiftLoads.length > 0 && <div style={P.sc}><div style={P.sct}>Incoming: {selectedNext?.name || "—"} Loading Plan</div>
          <div style={P.g3}>{Object.entries(AREA_MAP).map(([code, name]) => { const al = nextShiftLoads.filter(r => r.areaCode === code); const op2 = Math.max(0, Math.ceil(al.length / LOADS_PER_OP)); return <div key={code} style={P.ab(AC2[code] || "#999")}><div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: 0.5, color: "#555", fontWeight: 700 }}>{name}</div><div style={{ fontSize: "13pt", fontWeight: 800, color: AC2[code] || "#333" }}>{al.length}</div><div style={{ fontSize: "7pt", color: "#777" }}>{op2} ops needed · {al.filter(r => r.loadType === "PRE").length} preload · {al.filter(r => r.loadType === "LIV" || r.loadType === "PU").length} live</div></div> })}</div>
        </div>}
        {/* Production Lines */}
        <div style={P.sc}><div style={P.sct}>Production Lines</div>
          <div style={P.g2}>
            <div><div style={{ fontWeight: 700, fontSize: "8pt", color: "#777", marginBottom: 4 }}>TODAY — {handoverDate}</div>
              {pLines.map(l => <div key={l.name}><div style={P.lr}><b>{l.name}</b><span style={{ color: l.run ? "#059669" : "#dc2626", fontWeight: 700 }}>{l.run}/{l.tot}{l.run ? "" : " DOWN"}</span></div>{l.pr.length > 0 && <div style={P.pr2}>{l.pr.map(m => `${m.id}: ${m.p}`).join(" · ")}</div>}{l.down.length > 0 && <div style={{ ...P.pr2, color: "#dc2626" }}>{l.down.join(", ")} down</div>}</div>)}
            </div>
            <div><div style={{ fontWeight: 700, fontSize: "8pt", color: "#777", marginBottom: 4 }}>TOMORROW — {tomorrowStr}</div>
              {Object.keys(tomorrowMachines).length ? pLines.map(l => <div key={l.name}><div style={P.lr}><b>{l.name}</b><span style={{ color: l.tr ? "#059669" : "#dc2626", fontWeight: 700 }}>{l.tr}/{l.tt}</span></div>{l.td2.length > 0 && <div style={{ ...P.pr2, color: "#dc2626" }}>{l.td2.join(", ")} down</div>}</div>) : <div style={{ color: "#999", fontSize: "8pt" }}>No plan data for tomorrow.</div>}
            </div>
          </div>
        </div>
        {/* Notes */}
        {pNotes.length > 0 && <div style={P.sc}><div style={P.sct}>Handover Notes</div>{pNotes.map(([k, v]) => <div key={k} style={P.nb}><div style={{ fontSize: "8pt", fontWeight: 700, textTransform: "uppercase", color: "#555", marginBottom: 1 }}>{pNoteLabels[k] || k}</div><div style={{ fontSize: "8.5pt", whiteSpace: "pre-wrap" }}>{v}</div></div>)}</div>}
        {/* AI Summary */}
        {aiSummary && <div style={P.sc}><div style={{ padding: "8px 10px", border: "1.5px solid #7c3aed", borderRadius: 6, background: "#faf5ff" }}><div style={{ fontSize: "9pt", color: "#7c3aed", fontWeight: 700, marginBottom: 4 }}>AI Handover Summary</div><div style={{ fontSize: "8.5pt", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{aiSummary.split(/\*\*(.*?)\*\*/g).map((part, i) => i % 2 === 1 ? <b key={i} style={{ color: "#7c3aed" }}>{part}</b> : <span key={i}>{part}</span>)}</div></div></div>}
        {/* Footer */}
        <div style={{ marginTop: 14, paddingTop: 6, borderTop: "1.5px solid #ddd", display: "flex", justifyContent: "space-between", fontSize: "7pt", color: "#999" }}><div>Prepared by {team.flm} — {team.name}</div><div>{new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div></div>
      </div>
    </div>);
  }

  return (<div>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: team.color }}>{team.name}</span>
          <span style={{ color: "#475569", fontSize: 18 }}>→</span>
          <span style={{ color: selectedNext?.color || "#64748B" }}>{selectedNext?.name || "Unknown"}</span>
        </h2>
        <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>
          Handover from {team.flm} ({myType === "day" ? "Days" : "Nights"}) to {selectedNext?.flm || "—"} ({nextType === "day" ? "Days" : "Nights"})
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={printHandover} disabled={myType === "off"} style={{ ...S.bp, background: myType === "off" ? "#334155" : "linear-gradient(135deg,#10B981,#059669)", fontSize: 12, padding: "8px 14px", opacity: myType === "off" ? 0.4 : 1 }}>🖨️ Print Handover</button>
        <button onClick={generateWhatsApp} disabled={myType === "off" || !myLoads.length} style={{ ...S.bp, background: myType === "off" || !myLoads.length ? "#334155" : "linear-gradient(135deg,#25D366,#128C7E)", fontSize: 12, padding: "8px 14px", opacity: myType === "off" || !myLoads.length ? 0.4 : 1 }}>📱 WhatsApp Update</button>
        <div>
          <label style={{ ...S.lbl, marginBottom: 2 }}>Date</label>
          <input type="date" value={handoverDate} onChange={e => setHandoverDate(e.target.value)} style={{ ...S.inp, width: 150, padding: "5px 8px", fontSize: 12 }} />
        </div>
        <div>
          <label style={{ ...S.lbl, marginBottom: 2 }}>Handing to</label>
          <select value={overrideShift} onChange={e => setOverrideShift(e.target.value)} style={{ ...S.inp, width: 150, padding: "5px 8px", fontSize: 12, appearance: "auto" }}>
            <option value="">Auto-detect</option>
            {SHIFTS.filter(s => s.id !== shift.id).map(s => <option key={s.id} value={s.id}>{s.name} — {s.flm}</option>)}
          </select>
        </div>
      </div>
    </div>

    {/* WhatsApp Update Message */}
    {waMsg && <div style={{ ...S.card, marginBottom: 16, borderColor: "rgba(37,211,102,0.2)", background: "rgba(37,211,102,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#25D366" }}>📱 WhatsApp Update — Comm Supply Log</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={generateWhatsApp} style={{ ...S.bg, fontSize: 10, padding: "4px 10px", color: "#94A3B8" }}>🔄 Refresh</button>
          <button onClick={copyWhatsApp} style={{ ...S.bp, background: waCopied ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#25D366,#128C7E)", fontSize: 10, padding: "4px 12px" }}>{waCopied ? "✓ Copied!" : "📋 Copy"}</button>
        </div>
      </div>
      <pre style={{ fontSize: 12, lineHeight: 1.6, color: "#E2E8F0", background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "'DM Sans',sans-serif", margin: 0 }}>{waMsg}</pre>
    </div>}

    {myType === "off" && <div style={{ ...S.card, textAlign: "center", padding: 40, background: "rgba(100,116,139,0.08)", borderColor: "rgba(100,116,139,0.2)" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🌙</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#94A3B8" }}>Off Day</div>
      <div style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>No handover needed — {team.name} is not working on {handoverDate}. Select a working date above.</div>
    </div>}

    {myType !== "off" && <>
      {/* Status Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 8 }}>
        <StatusBadge count={myLoads.length} label="Total Loads" color="#3B82F6" />
        <StatusBadge count={completedLoads.length} label="Completed" color="#10B981" />
        <StatusBadge count={inProgressLoads.length} label="In Progress" color="#F59E0B" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        <StatusBadge count={pendingLoads.length} label="Pending" color="#EF4444" />
        <StatusBadge count={waitingLoads.length} label="Waiting Collection" color="#8B5CF6" />
        <StatusBadge count={onsiteLoads.length} label="Driver Onsite" color="#0EA5E9" />
      </div>

      {/* Staffing Overview */}
      {(() => {
        const myStaff = getShiftStaffing(spKey, handoverDate);
        const nextKey = selectedNext?.id?.replace(/^t/i, "").toUpperCase();
        const nextDate = myType === "night" ? fmt(ad(hDate, 1)) : handoverDate;
        const nextStaff = nextKey ? getShiftStaffing(nextKey, nextDate) : null;
        const agencyToday = staffingPlan?.agency?.filter(a => isWorking(a.days[handoverDate])) || [];
        const agencyNext = staffingPlan?.agency?.filter(a => isWorking(a.days[nextDate])) || [];
        if (!myStaff && !nextStaff) return null;
        return <div style={{ ...S.card, marginBottom: 16, borderColor: "rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.03)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#10B981", display: "flex", alignItems: "center", gap: 8 }}>👥 Staffing
            {(!myStaff?.exact || !nextStaff?.exact) && <span style={{ fontSize: 9, fontWeight: 500, color: "#64748B", background: "rgba(100,116,139,0.1)", padding: "2px 6px", borderRadius: 4 }}>
              ⓘ Estimated — plan covers {staffingPlan?.dates?.[0] || "?"} to {staffingPlan?.dates?.slice(-1)[0] || "?"}
            </span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: nextStaff ? "1fr 1fr" : "1fr", gap: 12 }}>
            {/* Current shift */}
            {myStaff && <div>
              <div style={{ fontWeight: 700, fontSize: 11, color: team.color, textTransform: "uppercase", marginBottom: 6 }}>{team.name} — {handoverDate}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ background: "#10B98122", color: "#10B981", fontWeight: 700, fontSize: 20, padding: "4px 12px", borderRadius: 6 }}>{myStaff.working.length}<span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4 }}>/ {myStaff.total}</span></span>
                {myStaff.days.length > 0 && <span style={{ ...S.chip("#F59E0B"), fontSize: 10 }}>{myStaff.days.length} Day</span>}
                {myStaff.nights.length > 0 && <span style={{ ...S.chip("#818CF8"), fontSize: 10 }}>{myStaff.nights.length} Night</span>}
                {agencyToday.length > 0 && <span style={{ ...S.chip("#F59E0B"), fontSize: 10 }}>+{agencyToday.length} Agency</span>}
              </div>
              {(myStaff.hol.length > 0 || myStaff.sick.length > 0 || myStaff.tenM.length > 0) && <div style={{ fontSize: 10, color: "#94A3B8" }}>
                {myStaff.hol.length > 0 && <span style={{ marginRight: 8 }}>🏖️ {myStaff.hol.length} Holiday: <span style={{ color: "#EF4444" }}>{myStaff.hol.map(o => o.name.split(" ")[0]).join(", ")}</span></span>}
                {myStaff.sick.length > 0 && <span style={{ marginRight: 8 }}>🤒 {myStaff.sick.length} Sick: <span style={{ color: "#dc2626" }}>{myStaff.sick.map(o => o.name.split(" ")[0]).join(", ")}</span></span>}
                {myStaff.tenM.length > 0 && <span>📅 {myStaff.tenM.length} 10M: <span style={{ color: "#64748B" }}>{myStaff.tenM.map(o => o.name.split(" ")[0]).join(", ")}</span></span>}
              </div>}
            </div>}
            {/* Incoming shift */}
            {nextStaff && <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: selectedNext?.color || "#64748B", textTransform: "uppercase", marginBottom: 6 }}>{selectedNext?.name || "—"} — {nextDate}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ background: "#10B98122", color: "#10B981", fontWeight: 700, fontSize: 20, padding: "4px 12px", borderRadius: 6 }}>{nextStaff.working.length}<span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4 }}>/ {nextStaff.total}</span></span>
                {nextStaff.days.length > 0 && <span style={{ ...S.chip("#F59E0B"), fontSize: 10 }}>{nextStaff.days.length} Day</span>}
                {nextStaff.nights.length > 0 && <span style={{ ...S.chip("#818CF8"), fontSize: 10 }}>{nextStaff.nights.length} Night</span>}
                {agencyNext.length > 0 && <span style={{ ...S.chip("#F59E0B"), fontSize: 10 }}>+{agencyNext.length} Agency</span>}
              </div>
              {(nextStaff.hol.length > 0 || nextStaff.sick.length > 0 || nextStaff.tenM.length > 0) && <div style={{ fontSize: 10, color: "#94A3B8" }}>
                {nextStaff.hol.length > 0 && <span style={{ marginRight: 8 }}>🏖️ {nextStaff.hol.length} Hol</span>}
                {nextStaff.sick.length > 0 && <span style={{ marginRight: 8 }}>🤒 {nextStaff.sick.length} Sick</span>}
                {nextStaff.tenM.length > 0 && <span>📅 {nextStaff.tenM.length} 10M</span>}
              </div>}
            </div>}
          </div>
        </div>;
      })()}

      {/* Outstanding Loads Detail */}
      <div style={{ ...S.card, marginBottom: 16, borderColor: outstandingLoads.length ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)", background: outstandingLoads.length ? "rgba(239,68,68,0.03)" : "rgba(16,185,129,0.03)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          {outstandingLoads.length ? <><span style={{ color: "#EF4444" }}>⚠️ {outstandingLoads.length} Outstanding Loads</span><span style={{ fontSize: 11, color: "#64748B", fontWeight: 400 }}>to hand over</span></>
            : <span style={{ color: "#10B981" }}>✅ All Loads Completed</span>}
        </div>
        {outstandingLoads.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          {Object.entries(AREA_MAP).map(([code, name]) => {
            const aLoads = outstandingLoads.filter(r => r.areaCode === code);
            const col = AREA_COLORS[code];
            return <div key={code} style={{ padding: 10, borderRadius: 8, background: `${col}08`, border: `1px solid ${col}22` }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: col, textTransform: "uppercase", marginBottom: 4 }}>{name}</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: col }}>{aLoads.length}</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>
                {aLoads.filter(r => r._status === "inprogress").length} in prog · {aLoads.filter(r => r._status === "pending").length} pending{aLoads.filter(r => r._status === "waiting").length > 0 && ` · ${aLoads.filter(r => r._status === "waiting").length} waiting`}{aLoads.filter(r => r._status === "onsite").length > 0 && ` · ${aLoads.filter(r => r._status === "onsite").length} onsite`}
              </div>
            </div>;
          })}
        </div>}
        {outstandingLoads.length > 0 && <div style={{ maxHeight: 200, overflowY: "auto", borderRadius: 6, background: "rgba(0,0,0,0.2)", padding: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 80px 1fr 80px 80px", gap: 4, padding: "4px 6px", fontWeight: 700, fontSize: 9, color: "#64748B", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>Load ID</div><div>Area</div><div>Carrier</div><div>Type</div><div>Status</div>
          </div>
          {outstandingLoads.map(r => {
            const ST_MAP = { inprogress: { l: "IN PROG", bg: "rgba(245,158,11,0.15)", c: "#F59E0B" }, pending: { l: "PENDING", bg: "rgba(239,68,68,0.1)", c: "#EF4444" }, waiting: { l: "WAITING", bg: "rgba(139,92,246,0.15)", c: "#8B5CF6" }, onsite: { l: "ONSITE", bg: "rgba(14,165,233,0.15)", c: "#0EA5E9" } };
            const st = ST_MAP[r._status] || ST_MAP.pending;
            return <div key={r.loadId} style={{ display: "grid", gridTemplateColumns: "90px 80px 1fr 80px 80px", gap: 4, padding: "4px 6px", fontSize: 10, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#CBD5E1" }}>{r.loadId}</div>
              <div style={{ color: AREA_COLORS[r.areaCode] || "#94A3B8", fontWeight: 600 }}>{r.areaName}</div>
              <div style={{ color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.carrier}</div>
              <div><span style={{ ...S.chip(TYPE_COLORS[r.loadType]), fontSize: 8, padding: "1px 6px" }}>{TYPE_LABELS[r.loadType] || r.loadType}</span></div>
              <div><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: st.bg, color: st.c }}>{st.l}</span></div>
            </div>;
          })}
        </div>}
      </div>

      {/* Production Lines Snapshot */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#3B82F6" }}>🏭 Production Lines</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {/* Today */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#64748B", textTransform: "uppercase", marginBottom: 6 }}>Today — {handoverDate}</div>
            {lines.map(l => {
              const running = l.machines.filter(m => todayMachines[m.id] !== false);
              const down = l.machines.filter(m => todayMachines[m.id] === false);
              return <div key={l.id} style={{ padding: 8, borderRadius: 6, marginBottom: 4, background: running.length ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${running.length ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}` }}>
                <div style={{ fontWeight: 700, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span>{l.name}</span>
                  <span style={{ fontSize: 10, color: running.length ? "#10B981" : "#EF4444", fontWeight: 700 }}>{running.length}/{l.machines.length}</span>
                </div>
                {running.length > 0 && <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                  {running.map(m => { const pr = planProducts[handoverDate]?.[m.id]; return <span key={m.id} style={{ fontSize: 8, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: "rgba(16,185,129,0.15)", color: "#10B981" }} title={pr || ""}>{m.id}{pr ? `: ${pr}` : ""}</span> })}
                </div>}
                {down.length > 0 && <div style={{ display: "flex", gap: 3, marginTop: 2, flexWrap: "wrap" }}>
                  {down.map(m => <span key={m.id} style={{ fontSize: 8, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{m.id} DOWN</span>)}
                </div>}
              </div>;
            })}
          </div>
          {/* Tomorrow */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#64748B", textTransform: "uppercase", marginBottom: 6 }}>Tomorrow — {tomorrowStr}</div>
            {Object.keys(tomorrowMachines).length ? lines.map(l => {
              const running = l.machines.filter(m => tomorrowMachines[m.id] !== false);
              const down = l.machines.filter(m => tomorrowMachines[m.id] === false);
              const changes = l.machines.filter(m => (todayMachines[m.id] === false) !== (tomorrowMachines[m.id] === false));
              return <div key={l.id} style={{ padding: 8, borderRadius: 6, marginBottom: 4, background: changes.length ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${changes.length ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)"}` }}>
                <div style={{ fontWeight: 700, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span>{l.name}</span>
                  <span style={{ fontSize: 10, color: running.length ? "#10B981" : "#EF4444", fontWeight: 700 }}>{running.length}/{l.machines.length}</span>
                </div>
                {changes.length > 0 && <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                  {changes.map(m => { const wasDown = todayMachines[m.id] === false; const willDown = tomorrowMachines[m.id] === false; return <span key={m.id} style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: wasDown ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)", color: wasDown ? "#10B981" : "#EF4444" }}>{m.id}: {wasDown ? "⬆ STARTING" : "⬇ STOPPING"}</span> })}
                </div>}
              </div>;
            }) : <div style={{ ...S.card, padding: 20, textAlign: "center", color: "#475569", fontSize: 12 }}>No plan data for tomorrow. Upload production plans to see changes.</div>}
          </div>
        </div>
      </div>

      {/* Incoming Shift TMS */}
      <div style={{ ...S.card, marginBottom: 16, borderColor: selectedNext ? `${selectedNext.color}33` : "rgba(255,255,255,0.06)", background: selectedNext ? `${selectedNext.color}04` : "transparent" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: selectedNext?.color || "#64748B" }}>
              🚛 Incoming: {selectedNext?.name || "Unknown"} Loading Plan
            </div>
            <div style={{ fontSize: 11, color: "#64748B" }}>Upload TMS extract for {selectedNext?.flm || "incoming FLM"}'s shift</div>
          </div>
          <label style={{ ...S.bg, cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1, background: selectedNext ? `${selectedNext.color}15` : "rgba(255,255,255,0.05)", color: selectedNext?.color || "#CBD5E1" }}>
            <input type="file" accept=".xlsx,.xls,.csv" disabled={uploading}
              onChange={e => { if (e.target.files?.[0]) handleNextShiftUpload(e.target.files[0]); e.target.value = "" }}
              style={{ display: "none" }} />
            {uploading ? "⏳ Parsing..." : "📄 Upload TMS"}
          </label>
        </div>
        {uploadLog.length > 0 && <div style={{ marginBottom: 10, padding: 6, background: "rgba(0,0,0,0.2)", borderRadius: 6, maxHeight: 80, overflowY: "auto" }}>{uploadLog.map((m, i) => <div key={i} style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: m.includes("✓") ? "#10B981" : m.includes("✕") ? "#EF4444" : "#94A3B8" }}>{m}</div>)}</div>}
        {nextShiftLoads.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {Object.entries(AREA_MAP).map(([code, name]) => {
            const aLoads = nextShiftLoads.filter(r => r.areaCode === code);
            const col = AREA_COLORS[code];
            const opsNeeded = Math.max(0, Math.ceil(aLoads.length / LOADS_PER_OP));
            return <div key={code} style={{ padding: 10, borderRadius: 8, background: `${col}08`, border: `1px solid ${col}22` }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: col, textTransform: "uppercase", marginBottom: 4 }}>{name}</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: col }}>{aLoads.length}</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>{opsNeeded} ops needed · {aLoads.filter(r => r.loadType === "PRE").length} preload · {aLoads.filter(r => r.loadType === "LIV" || r.loadType === "PU").length} live</div>
            </div>;
          })}
        </div> : <div style={{ padding: 16, textAlign: "center", color: "#475569", fontSize: 12 }}>No TMS data uploaded for incoming shift yet.</div>}
      </div>

      {/* Handover Notes */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📝 Handover Notes</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {[{ key: "safety", label: "⚠️ Safety / Incidents", color: "#EF4444", placeholder: "Any safety concerns, near misses, incidents..." },
          { key: "equipment", label: "🔧 Equipment / Breakdowns", color: "#F59E0B", placeholder: "FLT issues, machine faults, dock equipment..." },
          { key: "staffing", label: "👥 Staffing", color: "#3B82F6", placeholder: "Absences, agency staff, training notes..." },
          { key: "operations", label: "🏭 Operations", color: "#10B981", placeholder: "Special loads, priority orders, changeovers..." }
          ].map(n => <div key={n.key}>
            <label style={{ fontSize: 11, fontWeight: 700, color: n.color, marginBottom: 4, display: "block" }}>{n.label}</label>
            <textarea value={notes[n.key]} onChange={e => setNotes(p => ({ ...p, [n.key]: e.target.value }))} placeholder={n.placeholder}
              style={{ ...S.inp, minHeight: 70, resize: "vertical", fontSize: 12 }} />
          </div>)}
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 4, display: "block" }}>💬 Other</label>
          <textarea value={notes.other} onChange={e => setNotes(p => ({ ...p, other: e.target.value }))} placeholder="Any other information for the incoming shift..."
            style={{ ...S.inp, minHeight: 50, resize: "vertical", fontSize: 12 }} />
        </div>
      </div>

      {/* AI Summary */}
      <div style={{ ...S.card, borderColor: "rgba(168,85,247,0.2)", background: "rgba(168,85,247,0.03)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiSummary ? 12 : 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#A855F7", display: "flex", alignItems: "center", gap: 6 }}>✨ AI Handover Summary</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>Generates a concise briefing from all handover data</div>
          </div>
          <button onClick={generateSummary} disabled={aiLoading}
            style={{ ...S.bp, background: aiLoading ? "#475569" : "linear-gradient(135deg,#A855F7,#7C3AED)", cursor: aiLoading ? "wait" : "pointer", opacity: aiLoading ? 0.7 : 1 }}>
            {aiLoading ? "⏳ Generating..." : "✨ Generate Summary"}
          </button>
        </div>
        {aiSummary && <div style={{ marginTop: 8, padding: 16, background: "rgba(0,0,0,0.25)", borderRadius: 10, border: "1px solid rgba(168,85,247,0.15)" }}>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "#E2E8F0", whiteSpace: "pre-wrap" }}>
            {aiSummary.split(/\*\*(.*?)\*\*/g).map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: "#A855F7" }}>{part}</strong> : <span key={i}>{part}</span>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button onClick={generateSummary} style={{ ...S.bg, fontSize: 11, padding: "5px 12px", color: "#A855F7" }}>🔄 Regenerate</button>
          </div>
          <details style={{ marginTop: 8 }}><summary style={{ fontSize: 10, color: "#64748B", cursor: "pointer" }}>📋 Copy summary text</summary>
            <textarea readOnly value={aiSummary.replace(/\*\*/g, "")} onFocus={e => e.target.select()} style={{ width: "100%", marginTop: 6, minHeight: 120, background: "rgba(0,0,0,0.3)", color: "#CBD5E1", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: 8, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.5, resize: "vertical", outline: "none" }} />
          </details>
        </div>}
      </div>
    </>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   STAFFING VIEW — show parsed staffing plan for current shift
   ═══════════════════════════════════════════════════ */
function StaffingView({ staffingPlan, shiftId, team }) {
  const shiftKey = shiftId.replace(/^t/i, "").toUpperCase(); // tA -> A, tB -> B etc
  // Status categories
  const isWorking = s => ["D", "N", "DISDAM", "PD-DAYS", "PD-NIGHTS"].includes(s);
  const isDayShift = s => ["D", "DISDAM", "PD-DAYS"].includes(s);
  const isNightShift = s => ["N", "PD-NIGHTS"].includes(s);
  const isOff = s => ["H", "TOIL", "RO", "B"].includes(s);
  const isUnavail = s => ["S", "10M", "U"].includes(s);

  const STATUS_STYLE = {
    D: { bg: "#F59E0B22", col: "#F59E0B", label: "Day" },
    N: { bg: "#818CF822", col: "#818CF8", label: "Night" },
    H: { bg: "#EF444422", col: "#EF4444", label: "Holiday" },
    S: { bg: "#dc262622", col: "#dc2626", label: "Sick" },
    "10M": { bg: "#64748B22", col: "#64748B", label: "10M Contract" },
    B: { bg: "#78716C22", col: "#78716C", label: "Bereave" },
    RO: { bg: "#64748B22", col: "#94A3B8", label: "Rest Off" },
    TOIL: { bg: "#F59E0B15", col: "#D97706", label: "TOIL" },
    U: { bg: "#64748B22", col: "#94A3B8", label: "Unavail" },
    DISDAM: { bg: "#F59E0B22", col: "#F59E0B", label: "DISDAM" },
    "PD-DAYS": { bg: "#F59E0B22", col: "#F59E0B", label: "PD Day" },
    "PD-NIGHTS": { bg: "#818CF822", col: "#818CF8", label: "PD Night" },
  };

  if (!staffingPlan) return (<div style={{ textAlign: "center", padding: 40 }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
    <div style={{ fontWeight: 700, fontSize: 16, color: "#94A3B8" }}>No Staffing Plan Loaded</div>
    <div style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>Upload a weekly staffing XLSX on the home screen to see who's working.</div>
  </div>);

  const dates = staffingPlan.dates || [];
  const myFTE = staffingPlan.fte?.[shiftKey] || [];
  const allFTE = staffingPlan.fte || {};
  const agency = staffingPlan.agency || [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayStr = fmt(new Date());

  // Summary for my shift
  const daySummary = dates.map(d => {
    const dayW = myFTE.filter(op => isDayShift(op.days[d])).length;
    const nightW = myFTE.filter(op => isNightShift(op.days[d])).length;
    const hol = myFTE.filter(op => isOff(op.days[d])).length;
    const sick = myFTE.filter(op => op.days[d] === "S").length;
    const tenM = myFTE.filter(op => op.days[d] === "10M").length;
    return { d, working: dayW + nightW, dayW, nightW, hol, sick, tenM };
  });

  // Render a roster table
  const RosterTable = ({ ops, label, color, showPos }) => (
    <div style={{ ...S.card, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color }}>{label} ({ops.length})</div>
      {ops.length === 0 ? <div style={{ color: "#64748B", fontSize: 12, padding: 8 }}>No operators found. Try re-uploading the staffing XLSX.</div>
        : <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, fontSize: 10, color: "#64748B", textTransform: "uppercase", position: "sticky", left: 0, background: "var(--bg-card)", zIndex: 1, minWidth: 150 }}>Name</th>
              {showPos && <th style={{ padding: "6px 4px", fontWeight: 700, fontSize: 9, color: "#64748B", textTransform: "uppercase", width: 40 }}>Pos</th>}
              {dates.map(d => { const dt = new Date(d + "T12:00:00"); const isTd = d === todayStr; return <th key={d} style={{ padding: "6px 4px", fontWeight: 700, fontSize: 9, color: isTd ? team.color : "#64748B", textTransform: "uppercase", textAlign: "center", minWidth: 52, background: isTd ? "rgba(255,255,255,0.02)" : "transparent" }}>{dayNames[dt.getDay()]}<br /><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8 }}>{d.slice(8)}</span></th> })}
            </tr></thead>
            <tbody>
              {ops.map((op, i) => {
                const todaySt = op.days[todayStr];
                const rowBg = isWorking(todaySt) ? "rgba(16,185,129,0.03)" : isUnavail(todaySt) ? "rgba(239,68,68,0.03)" : "transparent";
                return <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: rowBg }}>
                  <td style={{ padding: "5px 8px", fontWeight: 600, fontSize: 11, position: "sticky", left: 0, background: "var(--bg-card)", zIndex: 1, borderRight: "1px solid rgba(255,255,255,0.04)", color: "#F9FAFB" }}>{op.name || "(No Name)"}</td>
                  {showPos && <td style={{ padding: "5px 4px", textAlign: "center" }}><span style={{ fontSize: 9, fontWeight: 600, color: op.position === "MOP" ? "#F59E0B" : "#64748B" }}>{op.position || "—"}</span></td>}
                  {dates.map(d => {
                    const st = op.days[d];
                    const sty = STATUS_STYLE[st];
                    const isTd = d === todayStr;
                    return <td key={d} style={{ padding: "3px 4px", textAlign: "center", background: isTd ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      {st ? <span style={{ display: "inline-block", minWidth: 32, padding: "2px 4px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: sty?.bg || "#33415522", color: sty?.col || "#64748B", textAlign: "center" }}>{sty?.label || st}</span>
                        : <span style={{ color: "#1E293B", fontSize: 10 }}>—</span>}
                    </td>;
                  })}
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
    </div>
  );

  return (<div>
    <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>
      <span style={{ color: team.color }}>{team.name}</span>
      <span style={{ color: "#64748B", fontSize: 14, fontWeight: 400, marginLeft: 8 }}>Staffing Plan — WK {staffingPlan.week}</span>
    </h2>
    <p style={{ margin: "0 0 6px", color: "#64748B", fontSize: 12 }}>{myFTE.length} FTE operators · {dates.length} days · {agency.length} agency workers</p>

    {/* Debug info if FTE empty */}
    {myFTE.length === 0 && <div style={{ ...S.card, padding: 12, marginBottom: 12, borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "#EF4444", marginBottom: 4 }}>⚠️ No FTE data for {shiftKey} Shift</div>
      <div style={{ fontSize: 11, color: "#94A3B8" }}>
        Parsed shifts: {Object.entries(allFTE).map(([k, v]) => `${k}=${v.length}`).join(", ")}.
        Please re-upload the staffing XLSX from the home screen — the parser has been updated.
      </div>
    </div>}

    {/* Summary cards */}
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(dates.length, 7)},1fr)`, gap: 6, marginBottom: 20 }}>
      {daySummary.map(s => {
        const dt = new Date(s.d + "T12:00:00");
        const isTd = s.d === todayStr;
        return <div key={s.d} style={{ ...S.card, padding: 10, textAlign: "center", borderColor: isTd ? `${team.color}55` : "rgba(255,255,255,0.06)", background: isTd ? `${team.color}08` : "transparent" }}>
          <div style={{ fontWeight: 700, fontSize: 10, color: isTd ? team.color : "#64748B", textTransform: "uppercase" }}>{dayNames[dt.getDay()]}</div>
          <div style={{ fontWeight: 600, fontSize: 9, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{s.d.slice(5)}</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: s.working > 0 ? "#10B981" : "#EF4444", marginTop: 4 }}>{s.working}</div>
          <div style={{ fontSize: 9, color: "#64748B" }}>working</div>
          <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 4, flexWrap: "wrap" }}>
            {s.dayW > 0 && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#F59E0B22", color: "#F59E0B", fontWeight: 600 }}>{s.dayW}D</span>}
            {s.nightW > 0 && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#818CF822", color: "#818CF8", fontWeight: 600 }}>{s.nightW}N</span>}
            {s.hol > 0 && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#EF444422", color: "#EF4444", fontWeight: 600 }}>{s.hol}H</span>}
            {s.sick > 0 && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#dc262622", color: "#dc2626", fontWeight: 600 }}>{s.sick}S</span>}
            {s.tenM > 0 && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#64748B22", color: "#64748B", fontWeight: 600 }}>{s.tenM}10M</span>}
          </div>
        </div>;
      })}
    </div>

    {/* Status legend */}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
      {[["D", "Day Shift"], ["N", "Night Shift"], ["H", "Holiday"], ["TOIL", "TOIL"], ["S", "Sick"], ["10M", "10M Contract"], ["B", "Bereavement"], ["RO", "Rest Off"], ["DISDAM", "DISDAM (Days)"], ["PD-DAYS", "PD Days"], ["PD-NIGHTS", "PD Nights"]].map(([k, lbl]) => {
        const sty = STATUS_STYLE[k];
        return <span key={k} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: sty.bg, color: sty.col, fontWeight: 600 }}>{lbl}</span>;
      })}
    </div>

    {/* My shift FTE */}
    <RosterTable ops={myFTE} label={`${team.name} — FTE Operators`} color={team.color} showPos={true} />

    {/* Agency */}
    {agency.length > 0 && <RosterTable ops={agency} label="Agency Workers" color="#F59E0B" showPos={false} />}

    {/* Other shifts (collapsed) */}
    {["A", "B", "C", "D"].filter(s => s !== shiftKey).map(s => {
      const ops = allFTE[s] || [];
      if (!ops.length) return null;
      const sc = SHIFTS.find(sh => sh.id === s.toLowerCase())?.color || "#64748B";
      return <details key={s} style={{ marginBottom: 8 }}>
        <summary style={{ cursor: "pointer", padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.03)", fontWeight: 700, fontSize: 12, color: sc }}>{s} Shift ({ops.length} operators)</summary>
        <div style={{ marginTop: 8 }}><RosterTable ops={ops} label={`${s} Shift — FTE`} color={sc} showPos={true} /></div>
      </details>;
    })}
  </div>);
}

/* ═══════════════════════════════════════════════════
   LINES VIEW (shared)
   ═══════════════════════════════════════════════════ */
function LinesView({ lines, machineStatus, setMachineStatus, wd, planProducts, setPlanProducts }) {
  const [uploading, setUploading] = useState(false);
  const [log, setLog] = useState([]);
  const [showUp, setShowUp] = useState(false);
  const toggle = (ds, mid) => setMachineStatus(p => { const day = { ...(p[ds] || {}) }; day[mid] = day[mid] === false ? true : false; return { ...p, [ds]: day } });
  const loadBuiltin = () => {
    const ns = { ...machineStatus };
    Object.entries(PLAN_STATUS).forEach(([ds, ms]) => { ns[ds] = { ...(ns[ds] || {}) }; Object.entries(ms).forEach(([mid, r]) => { ns[ds][mid] = r ? true : false }) });
    setMachineStatus(ns); setPlanProducts({ ...planProducts, ...PLAN_PRODUCTS });
  };
  const handleUpload = async (files) => {
    setUploading(true); setLog(["⏳ Parsing production plans..."]);
    const ns = { ...machineStatus }, np = { ...planProducts };
    let totalUpdated = 0;
    for (const file of files) {
      try {
        setLog(p => [...p, `⏳ ${file.name}...`]);
        const b64 = await new Promise((r, j) => { const rd = new FileReader(); rd.onload = () => r(rd.result.split(",")[1]); rd.onerror = j; rd.readAsDataURL(file) });
        const resp = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
            model: "claude-sonnet-4-20250514", max_tokens: 8000, messages: [{
              role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }, {
                type: "text", text: `Parse this Magor Packaging Plans PDF. Machine mapping: MAGD1=MAC1, MAGC2=MAC2, MAGN3=MAB1, MAGN4=MAB2, MAGN5=MAB3, MAGN6=MAB4, MAGKG=MAK1. Check EVERY page header for machine codes.

CRITICAL: Each production row has this format:
START_DATE START_TIME END_DATE END_TIME **SKU** PRODUCT_DESCRIPTION PO_Nr ...
Example: "06/02/2026 07:30 07/02/2026 08:32 71219 STEL ART 4.6% CAN 18 0,44L BOX 7400134849"
The SKU is the 5-6 digit number IMMEDIATELY after the end time (71219 in this example). NEVER use the product description text.

Return ONLY a JSON array: [{"machine":"MAC1","days":{"2026-02-06":{"running":true,"product":"71219"}}}]
- "product" must be ONLY the numeric SKU (e.g. "71219", "108280", "62232"). NEVER a product name/description.
- If multiple SKUs run on the same day, join with / (e.g. "71219/108958")
- Rows starting with "-----" (Clean Day/OVERHAUL/SHUTDOWN/LINE NOT STAFFED/No Demand/APO SPLIT) = running:false, product:""
- running=true if any production run overlaps that day
- Include every day visible. Return pure JSON only, no markdown.`}]
            }]
          })
        });
        if (!resp.ok) { setLog(p => [...p, `✕ ${file.name}: API error ${resp.status}`]); continue }
        const data = await resp.json();
        const text = data.content?.map(c => c.text || "").join("") || "";
        const clean = text.replace(/```json|```/g, "").trim();
        let arr;
        try { arr = JSON.parse(clean) } catch (pe) {
          // Try to extract JSON from text
          const jm = clean.match(/\[[\s\S]*\]/);
          if (jm) arr = JSON.parse(jm[0]);
          else throw new Error("Could not parse JSON from response");
        }
        const items = Array.isArray(arr) ? arr : [arr];
        items.forEach(r => {
          if (!r.machine || !r.days) return;
          let runDays = 0, downDays = 0;
          Object.entries(r.days).forEach(([ds, info]) => {
            if (!ns[ds]) ns[ds] = {};
            if (!np[ds]) np[ds] = {};
            const isRunning = !!info.running;
            ns[ds][r.machine] = isRunning ? true : false;
            if (isRunning) {
              runDays++;
              if (info.product) np[ds][r.machine] = info.product;
            } else { downDays++ }
            totalUpdated++;
          });
          setLog(p => [...p, `  ✓ ${r.machine}: ${runDays} RUN, ${downDays} DOWN`]);
        });
        setLog(p => [...p, `✓ ${file.name} done`]);
      } catch (e) { setLog(p => [...p, `✕ ${file.name}: ${e.message}`]) }
    }
    setMachineStatus(ns); setPlanProducts(np); setUploading(false);
    setLog(p => [...p, `✅ Complete — ${totalUpdated} machine-days updated. Lines grid now shows RUN/DOWN status.`]);
  };
  const planDays = Object.keys(machineStatus).filter(ds => Object.values(machineStatus[ds] || {}).some(v => v === true || v === false)).length;
  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Production Lines</h2><p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>Shared across all shifts{planDays > 0 && <span style={{ color: "#10B981", fontWeight: 600 }}> · {planDays} days with plan data</span>}</p></div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setShowUp(!showUp)} style={{ ...S.bg, background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>📄 Upload Plans</button>
        <button onClick={loadBuiltin} style={{ ...S.bg }}>Load Feb 2026</button>
      </div>
    </div>
    {showUp && <div style={{ ...S.card, marginBottom: 16, borderColor: "rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.04)" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#3B82F6", marginBottom: 8 }}>Upload Production Plan PDFs</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ ...S.bp, background: "linear-gradient(135deg,#3B82F6,#2563EB)", color: "#fff", cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          <input type="file" accept=".pdf" multiple disabled={uploading} onChange={e => { if (e.target.files?.length) handleUpload(Array.from(e.target.files)); e.target.value = "" }} style={{ display: "none" }} />
          {uploading ? "⏳ Parsing..." : "📄 Select PDFs"}
        </label>
      </div>
      {log.length > 0 && <div style={{ marginTop: 10, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: 6, maxHeight: 140, overflowY: "auto" }}>{log.map((m, i) => <div key={i} style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: m.includes("✓") ? "#10B981" : m.includes("✕") ? "#EF4444" : "#94A3B8", padding: "1px 0" }}>{m}</div>)}</div>}
    </div>}
    {lines.map(line => <div key={line.id} style={{ ...S.card, marginBottom: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{line.name} <span style={{ fontWeight: 400, fontSize: 12, color: "#64748B" }}>· {line.normalOps} ops normal · {line.minOps} min</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7,1fr)", gap: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 10, color: "#64748B" }}>Machine</div>
        {wd.map((d, i) => <div key={i} style={{ textAlign: "center", fontWeight: 700, fontSize: 10, color: "#64748B" }}>{DAYS[i]} {d.getDate()}</div>)}
        {line.machines.map(m => <Fragment key={m.id}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#E2E8F0", display: "flex", alignItems: "center" }}>{m.id}</div>
          {wd.map((d, i) => {
            const ds = fmt(d), up = machineStatus[ds]?.[m.id] !== false, pr = planProducts[ds]?.[m.id] || ""; return <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <button onClick={() => toggle(ds, m.id)} title={pr} style={{ padding: "4px 6px", borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 10, fontFamily: "inherit", background: up ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: up ? "#10B981" : "#EF4444", width: "100%" }}>{up ? "✓ RUN" : "✕ DOWN"}</button>
              {pr && up && <div style={{ fontSize: 7, color: "#64748B", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pr}>{pr}</div>}
            </div>
          })}
        </Fragment>)}
      </div>
    </div>)}
  </div>);
}

/* ═══════════════════════════════════════════════════
   LOADING VIEW (shared - TMS data)
   ═══════════════════════════════════════════════════ */
const AREA_MAP = { "MAGCAN": "Magor 1", "MAGNEW": "Tents", "MAGKEG": "Keg Loading" };
const AREA_COLORS = { "MAGCAN": "#F59E0B", "MAGNEW": "#3B82F6", "MAGKEG": "#10B981" };
const TYPE_LABELS = { "PRE": "Preload", "LIV": "Live Load", "IN": "Inbound", "PU": "Live Load", "Pre-Advised": "Preload", "PREADV": "Preload" };
const TYPE_COLORS = { "PRE": "#A855F7", "LIV": "#F59E0B", "IN": "#3B82F6", "PU": "#F59E0B", "Pre-Advised": "#A855F7", "PREADV": "#A855F7" };
const SHIFT_DAY_START = 7, SHIFT_DAY_END = 19;
const LOAD_DAY_START = 10, LOAD_DAY_END = 22;

function parseDockId(dockId) {
  const p = (dockId || "").split(".");
  return { priority: p[0] || "", area: p[1] || "", type: p[2] || "", dock: p[3] || "" };
}
function parseSlotShift(dtStr) {
  if (!dtStr) return { date: null, shift: null, hour: null };
  const s = String(dtStr);
  // Try DD/MM/YYYY HH:MM
  let m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) { const [, dd, mm, yy, hh] = m; return { date: `${yy}-${mm}-${dd}`, shift: parseInt(hh) >= SHIFT_DAY_START && parseInt(hh) < SHIFT_DAY_END ? "day" : "night", hour: parseInt(hh) } }
  // Try YYYY-MM-DD HH:MM or ISO format
  m = s.match(/(\d{4})-(\d{2})-(\d{2})[\sT]+(\d{2}):(\d{2})/);
  if (m) { const [, yy, mm, dd, hh] = m; return { date: `${yy}-${mm}-${dd}`, shift: parseInt(hh) >= SHIFT_DAY_START && parseInt(hh) < SHIFT_DAY_END ? "day" : "night", hour: parseInt(hh) } }
  // Try MM/DD/YYYY HH:MM (US format SheetJS might use)
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) { const [, mm, dd, yy, hh] = m; return { date: `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`, shift: parseInt(hh) >= SHIFT_DAY_START && parseInt(hh) < SHIFT_DAY_END ? "day" : "night", hour: parseInt(hh) } }
  return { date: null, shift: null, hour: null };
}

function normalizeLoadType(t) {
  const u = (t || "").toUpperCase().replace(/[\s-]/g, "");
  if (u === "PU") return "LIV";
  if (u === "PREADVISED" || u === "PREADV" || u === "PRELOAD") return "PRE";
  if (u === "LIVELOAD" || u === "LIVE") return "LIV";
  return t === "PU" ? "LIV" : t;
}

function LoadingView({ loadingData, setLoadingData }) {
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState([]);
  const [filterDate, setFilterDate] = useState("");

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadLog(["⏳ Reading TMS export..."]);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: false, raw: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

      setUploadLog(p => [...p, `✓ Read ${rows.length} rows from ${file.name}`]);

      // Find columns by partial match (TMS exports may vary slightly)
      const cols = Object.keys(rows[0] || {});
      const findCol = (hint) => cols.find(c => c.toLowerCase().includes(hint.toLowerCase())) || "";
      const cSlot = findCol("Start Date");
      const cCarrier = findCol("Carrier");
      const cLoadId = findCol("Load ID");
      const cExtId = findCol("External");
      const cDock = findCol("Dock ID");
      const cCheckIn = findCol("Check-In");
      const cLoadStart = findCol("Loading/Unloading Started");
      const cLoadEnd = findCol("Loading/Unloading Ended");
      const cCheckOut = findCol("Check-Out");

      const enriched = rows.map(r => {
        const dockId = String(r[cDock] || "");
        const slotTime = String(r[cSlot] || "");
        const dock = parseDockId(dockId);
        const slot = parseSlotShift(slotTime);
        const loadType = normalizeLoadType(dock.type);
        return {
          slotTime,
          carrier: String(r[cCarrier] || ""),
          loadId: String(r[cLoadId] || ""),
          externalId: String(r[cExtId] || ""),
          dockId,
          checkIn: r[cCheckIn] || null,
          loadStart: r[cLoadStart] || null,
          loadEnd: r[cLoadEnd] || null,
          checkOut: r[cCheckOut] || null,
          areaCode: dock.area,
          areaName: AREA_MAP[dock.area] || dock.area,
          loadType,
          dockNum: dock.dock,
          date: slot.date,
          shift: slot.shift,
          hour: slot.hour,
        };
      }).filter(r => r.dockId && r.areaCode);

      const existing = new Set(loadingData.map(l => l.loadId));
      const newRows = enriched.filter(r => !existing.has(r.loadId));
      setLoadingData([...loadingData, ...newRows]);
      setUploadLog(p => [...p, `✓ Parsed ${enriched.length} loads (${newRows.length} new, ${enriched.length - newRows.length} duplicates skipped)`, `✓ Upload complete`]);
    } catch (err) {
      setUploadLog(p => [...p, `✕ Error: ${err.message}`]);
    }
    setUploading(false);
  };

  // Filter and aggregate
  const dates = [...new Set(loadingData.map(r => r.date).filter(Boolean))].sort();
  const filtered = filterDate ? loadingData.filter(r => r.date === filterDate) : loadingData;

  // Summary by date+shift+area
  const summary = {};
  filtered.forEach(r => {
    const k = `${r.date}_${r.shift}`;
    if (!summary[k]) summary[k] = { date: r.date, shift: r.shift, areas: {}, carriers: {}, total: 0 };
    const s = summary[k];
    s.total++;
    if (!s.areas[r.areaCode]) s.areas[r.areaCode] = { total: 0, types: {} };
    s.areas[r.areaCode].total++;
    s.areas[r.areaCode].types[r.loadType] = (s.areas[r.areaCode].types[r.loadType] || 0) + 1;
    s.carriers[r.carrier] = (s.carriers[r.carrier] || 0) + 1;
  });
  const summaryList = Object.values(summary).sort((a, b) => (a.date + a.shift).localeCompare(b.date + b.shift));

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Loading Plan</h2>
        <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>Upload TMS extracts to view load counts per area per shift. Guideline: ~{LOADS_PER_OP} loads per operator.</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ ...S.bp, cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          <input type="file" accept=".xlsx,.xls,.csv" disabled={uploading}
            onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = "" }}
            style={{ display: "none" }} />
          {uploading ? "⏳ Parsing..." : "📄 Upload TMS Extract"}
        </label>
        {loadingData.length > 0 && <button onClick={() => setLoadingData([])} style={{ ...S.bg, color: "#EF4444" }}>Clear All</button>}
      </div>
    </div>

    {uploadLog.length > 0 && <div style={{ ...S.card, marginBottom: 16, padding: 12, background: "rgba(0,0,0,0.2)" }}>
      {uploadLog.map((msg, i) => <div key={i} style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: msg.includes("✓") ? "#10B981" : msg.includes("✕") ? "#EF4444" : "#94A3B8", padding: "1px 0" }}>{msg}</div>)}
    </div>}

    {loadingData.length === 0 ?
      <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No Loading Data</div>
        <div style={{ color: "#64748B", fontSize: 13 }}>Upload a TMS export (.xlsx) to see load distribution across Magor 1, Tents, and Keg Loading.</div>
      </div>
      : <>
        {/* Date filter */}
        {dates.length > 1 && <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setFilterDate("")} style={{ ...S.chip(!filterDate ? "#F59E0B" : "#64748B"), cursor: "pointer", border: "none", fontFamily: "inherit" }}>All Dates</button>
          {dates.map(d => <button key={d} onClick={() => setFilterDate(d)} style={{ ...S.chip(filterDate === d ? "#F59E0B" : "#64748B"), cursor: "pointer", border: "none", fontFamily: "inherit" }}>{d}</button>)}
        </div>}

        {/* Area totals strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
          {Object.entries(AREA_MAP).map(([code, name]) => {
            const count = filtered.filter(r => r.areaCode === code).length;
            const opsNeeded = Math.max(0, Math.ceil(count / LOADS_PER_OP));
            const col = AREA_COLORS[code];
            return <div key={code} style={{ ...S.card, borderColor: `${col}33`, background: `${col}06`, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: col, textTransform: "uppercase", marginBottom: 4 }}>{name}</div>
              <div style={{ fontWeight: 800, fontSize: 28, color: col }}>{count}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>loads · <b style={{ color: "#E2E8F0" }}>{opsNeeded}</b> ops needed</div>
              <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                {Object.entries(TYPE_LABELS).map(([t, label]) => {
                  const c = filtered.filter(r => r.areaCode === code && r.loadType === t).length;
                  return c > 0 ? <span key={t} style={{ ...S.chip(TYPE_COLORS[t]), fontSize: 9 }}>{label}: {c}</span> : null;
                })}
              </div>
            </div>;
          })}
        </div>

        {/* Per shift breakdown */}
        {summaryList.map(s => {
          const opsNeeded = Math.max(1, Math.ceil(s.total / LOADS_PER_OP));
          const dayLabel = s.date ? new Date(s.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "Unknown";
          return <div key={s.date + s.shift} style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: s.shift === "day" ? "#F59E0B" : "#818CF8" }}>{s.shift === "day" ? <Ic.Sun /> : <Ic.Moon />}</span>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{dayLabel}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: s.shift === "day" ? "#F59E0B" : "#818CF8", marginLeft: 8 }}>{s.shift === "day" ? "Day Shift (07-19)" : "Night Shift (19-07)"}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{s.total} loads</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{opsNeeded} ops needed</div>
              </div>
            </div>

            {/* Areas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
              {Object.entries(AREA_MAP).map(([code, name]) => {
                const a = s.areas[code];
                if (!a) return <div key={code} style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.02)", textAlign: "center" }}><div style={{ fontSize: 11, color: "#475569" }}>{name}</div><div style={{ fontWeight: 700, color: "#334155" }}>—</div></div>;
                const col = AREA_COLORS[code];
                return <div key={code} style={{ padding: 10, borderRadius: 8, background: `${col}08`, border: `1px solid ${col}22`, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: col }}>{name}</div>
                  <div style={{ fontWeight: 800, fontSize: 20, color: col }}>{a.total}</div>
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
                    {Object.entries(a.types).map(([t, c]) => <span key={t} style={{ fontSize: 8, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: `${TYPE_COLORS[t] || "#64748B"}22`, color: TYPE_COLORS[t] || "#64748B" }}>{TYPE_LABELS[t] || t}: {c}</span>)}
                  </div>
                </div>;
              })}
            </div>

            {/* Carriers */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>Carriers</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.entries(s.carriers).sort((a, b) => b[1] - a[1]).map(([name, count]) =>
                  <span key={name} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#CBD5E1" }}>{name} <b>×{count}</b></span>
                )}
              </div>
            </div>
          </div>;
        })}

        {/* Department Sickness Card */}
        <div style={{ maxWidth: 700, margin: "0 auto 16px" }}>
          <DepartmentSicknessCard totalOperators={40} />
        </div>

        {/* Full load list */}
        <details style={{ ...S.card, cursor: "pointer" }}>
          <summary style={{ fontWeight: 700, fontSize: 13, color: "#94A3B8", padding: "4px 0" }}>All Loads ({filtered.length})</summary>
          <div style={{ marginTop: 12, maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                {["Slot", "Area", "Type", "Dock", "Carrier", "Load ID", "Status"].map(h => <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#64748B", fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((r, i) => {
                  const hasStart = !!r.loadStart; const hasEnd = !!r.loadEnd;
                  const status = hasEnd ? "Complete" : hasStart ? "In Progress" : "Pending";
                  const statusCol = hasEnd ? "#10B981" : hasStart ? "#F59E0B" : "#64748B";
                  return <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{r.slotTime}</td>
                    <td style={{ padding: "5px 8px" }}><span style={{ color: AREA_COLORS[r.areaCode] || "#CBD5E1", fontWeight: 600 }}>{r.areaName}</span></td>
                    <td style={{ padding: "5px 8px" }}><span style={{ ...S.chip(TYPE_COLORS[r.loadType]), fontSize: 9, padding: "1px 6px" }}>{TYPE_LABELS[r.loadType] || r.loadType}</span></td>
                    <td style={{ padding: "5px 8px", color: "#94A3B8" }}>{r.dockNum}</td>
                    <td style={{ padding: "5px 8px" }}>{r.carrier}</td>
                    <td style={{ padding: "5px 8px", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#64748B" }}>{r.loadId}</td>
                    <td style={{ padding: "5px 8px" }}><span style={{ fontWeight: 600, color: statusCol, fontSize: 10 }}>{status}</span></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </details>
      </>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   OPERATORS (shift-specific)
   ═══════════════════════════════════════════════════ */
function Ops({ ops, setOps, team, training }) {
  const [showAdd, setShowAdd] = useState(false);
  const [f, sF] = useState({ name: "" });
  const [eId, sEId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const save = () => { if (!f.name.trim()) return; if (eId) setOps(p => p.map(o => o.id === eId ? { ...o, name: f.name } : o)); else setOps(p => [...p, { id: uid(), name: f.name.trim(), quals: [] }]); sF({ name: "" }); setShowAdd(false); sEId(null) };

  const toggleQual = (opId, areaId) => {
    setOps(p => p.map(o => {
      if (o.id !== opId) return o;
      const q = o.quals || [];
      return { ...o, quals: q.includes(areaId) ? q.filter(x => x !== areaId) : [...q, areaId] };
    }));
  };

  const selectAll = (opId) => { setOps(p => p.map(o => o.id === opId ? { ...o, quals: QUAL_AREAS.map(a => a.id) } : o)) };
  const clearAll = (opId) => { setOps(p => p.map(o => o.id === opId ? { ...o, quals: [] } : o)) };
  const setPref = (opId, areaId) => { setOps(p => p.map(o => o.id === opId ? { ...o, prefArea: areaId || null } : o)) };

  const detailOp = ops.find(o => o.id === detailId);
  const qualCount = (op) => (op.quals || []).length;

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Operators</h2>
        <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>{ops.filter(o => !o.isAgency).length} FTE · {ops.filter(o => o.isAgency).length} Agency · FLM: {team.flm || "—"}</p>
      </div>
      <button onClick={() => { setShowAdd(true); sEId(null); sF({ name: "" }) }} style={S.bp}><Ic.Plus /> Add</button>
    </div>

    {showAdd && <div style={{ ...S.card, marginBottom: 16, background: `${team.color}08`, borderColor: `${team.color}33` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "end" }}>
        <div><label style={S.lbl}>Name</label><input value={f.name} onChange={e => sF({ name: e.target.value })} onKeyDown={e => e.key === "Enter" && save()} style={S.inp} placeholder="Full name" /></div>
        <button onClick={save} style={S.bp}><Ic.Check /> {eId ? "Update" : "Save"}</button>
      </div>
    </div>}

    <div style={{ display: "grid", gap: 4 }}>
      {ops.filter(o => !o.isAgency).length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4, marginTop: 8 }}>FTE Operators</div>}
      {ops.filter(o => !o.isAgency).map(op => {
        const prog = getSkapProgress(op.id, training);
        const lvl = prog.filter(p => p.pct === 100).length;
        const mod = SKAP_MODULES[lvl] || SKAP_MODULES[0];
        const quals = op.quals || [];
        const isOpen = detailId === op.id;
        const cardColor = team.color;

        return (<div key={op.id}>
          <div style={{ ...S.card, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderLeft: `3px solid ${cardColor}`, borderBottomLeftRadius: isOpen ? 0 : undefined, borderBottomRightRadius: isOpen ? 0 : undefined, marginBottom: isOpen ? 0 : undefined }}
            onClick={() => setDetailId(isOpen ? null : op.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: `${cardColor}22`, color: cardColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>{op.name.split(" ").map(n => n[0]).join("")}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{op.name}</div>
                <div style={{ fontSize: 10, color: "#64748B" }}>
                  {quals.length ? `${quals.length}/${QUAL_AREAS.length} areas` : "No qualifications set"} · SKAP: {mod.name}{op.prefArea ? ` · ⭐ ${QUAL_AREAS.find(a => a.id === op.prefArea)?.short || ""}` : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap", maxWidth: 260, justifyContent: "flex-end" }}>
              {quals.length > 0 ? QUAL_AREAS.filter(a => quals.includes(a.id)).map(a =>
                <span key={a.id} style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${a.color}18`, color: a.color }}>{a.short}</span>
              ) : <span style={{ fontSize: 9, color: "#475569" }}>Click to set areas</span>}
              <button onClick={e => { e.stopPropagation(); sF({ name: op.name }); sEId(op.id); setShowAdd(true) }} style={{ ...S.bg, padding: 3, border: "none", color: "#94A3B8", marginLeft: 4 }} title="Edit name">✏️</button>
              <button onClick={e => { e.stopPropagation(); setOps(p => p.filter(o => o.id !== op.id)) }} style={{ ...S.bg, padding: 3, border: "none", color: "#EF4444", marginLeft: 2 }}><Ic.Trash /></button>
            </div>
          </div>
          {isOpen && <div style={{ ...S.card, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 12, background: `${cardColor}04`, borderColor: `${cardColor}33` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: cardColor }}>Area Qualifications</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => selectAll(op.id)} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(16,185,129,0.15)", color: "#10B981", fontFamily: "inherit" }}>Select All</button>
                <button onClick={() => clearAll(op.id)} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.1)", color: "#EF4444", fontFamily: "inherit" }}>Clear All</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 4 }}>
              {QUAL_AREAS.map(a => {
                const has = quals.includes(a.id);
                return <button key={a.id} onClick={() => toggleQual(op.id, a.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, border: `1px solid ${has ? a.color + "44" : "rgba(255,255,255,0.06)"}`,
                  background: has ? `${a.color}12` : "rgba(255,255,255,0.02)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${has ? a.color : "#475569"}`, background: has ? a.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 800, flexShrink: 0 }}>{has ? "✓" : ""}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 11, color: has ? "#E2E8F0" : "#94A3B8" }}>{a.name}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: has ? a.color : "#475569" }}>{a.short}</div>
                  </div>
                </button>;
              })}
            </div>
            <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", whiteSpace: "nowrap" }}>⭐ Preferred Area</label>
                <select value={op.prefArea || ""} onChange={e => setPref(op.id, e.target.value)} style={{ ...S.inp, padding: "4px 8px", fontSize: 11, appearance: "auto", flex: 1, maxWidth: 200 }}>
                  <option value="">None</option>
                  {QUAL_AREAS.filter(a => quals.includes(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {op.prefArea && <span style={{ fontSize: 9, color: "#64748B" }}>Will be assigned here first when available</span>}
              </div>
            </div>
          </div>}
        </div>);
      })}

      {/* Agency Workers */}
      {ops.filter(o => o.isAgency).length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", marginBottom: 4, marginTop: 16 }}>Agency Workers</div>
        {ops.filter(o => o.isAgency).map(op => {
          const quals = op.quals || [];
          const isOpen = detailId === op.id;
          return (<div key={op.id}>
            <div style={{ ...S.card, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderLeft: "3px solid #F59E0B", borderBottomLeftRadius: isOpen ? 0 : undefined, borderBottomRightRadius: isOpen ? 0 : undefined, marginBottom: isOpen ? 0 : undefined }}
              onClick={() => setDetailId(isOpen ? null : op.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(245,158,11,0.2)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>{op.name.split(" ").map(n => n[0]).join("")}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>{op.name} <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>AGENCY</span></div>
                  <div style={{ fontSize: 10, color: "#64748B" }}>{quals.length ? `${quals.length}/${QUAL_AREAS.length} areas` : "No qualifications — defaults to Tents"}{op.prefArea ? ` · ⭐ ${QUAL_AREAS.find(a => a.id === op.prefArea)?.short || ""}` : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap", maxWidth: 260, justifyContent: "flex-end" }}>
                {quals.length > 0 ? QUAL_AREAS.filter(a => quals.includes(a.id)).map(a =>
                  <span key={a.id} style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${a.color}18`, color: a.color }}>{a.short}</span>
                ) : <span style={{ fontSize: 9, color: "#475569" }}>Click to set areas</span>}
              </div>
            </div>
            {isOpen && <div style={{ ...S.card, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 12, background: "rgba(245,158,11,0.03)", borderColor: "rgba(245,158,11,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#F59E0B" }}>Area Qualifications</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => selectAll(op.id)} style={{ ...S.bg, fontSize: 9, padding: "2px 8px" }}>Select All</button>
                  <button onClick={() => clearAll(op.id)} style={{ ...S.bg, fontSize: 9, padding: "2px 8px" }}>Clear</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3 }}>
                {QUAL_AREAS.map(a => {
                  const has = quals.includes(a.id);
                  return <button key={a.id} onClick={() => toggleQual(op.id, a.id)} style={{ padding: "6px 4px", borderRadius: 5, border: "1px solid", cursor: "pointer", fontFamily: "inherit", fontSize: 9, fontWeight: 700, textAlign: "center", background: has ? `${a.color}18` : "rgba(255,255,255,0.03)", borderColor: has ? `${a.color}44` : "rgba(255,255,255,0.08)", color: has ? a.color : "#475569" }}>
                    {a.short}<br /><span style={{ fontSize: 7, fontWeight: 500 }}>{a.name}</span>
                  </button>;
                })}
              </div>
              <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", whiteSpace: "nowrap" }}>⭐ Preferred Area</label>
                  <select value={op.prefArea || ""} onChange={e => setPref(op.id, e.target.value)} style={{ ...S.inp, padding: "4px 8px", fontSize: 11, appearance: "auto", flex: 1, maxWidth: 200 }}>
                    <option value="">None</option>
                    {QUAL_AREAS.filter(a => quals.includes(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>}
          </div>);
        })}
      </>}
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════
   SKAP OVERVIEW (shared reference)
   ═══════════════════════════════════════════════════ */
function Skap() {
  return (<div>
    <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>SKAP Framework</h2>
    <p style={{ margin: "0 0 20px", color: "#64748B", fontSize: 13 }}>6 modules · 131 tasks</p>
    {SKAP_MODULES.map(mod => {
      const tasks = SKAP_TASKS.filter(t => t.mod === mod.id); return (
        <div key={mod.id} style={{ ...S.card, marginBottom: 12, borderLeft: `4px solid ${mod.color}` }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: mod.color, marginBottom: 2 }}>{mod.id}: {mod.name}</div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>{tasks.length} tasks · {tasks.filter(t => t.area).length} area-specific</div>
          <div style={{ display: "grid", gap: 2, maxHeight: 250, overflowY: "auto" }}>
            {tasks.map(t => <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: mod.color, fontWeight: 700, minWidth: 50 }}>{t.id}</span>
              <span style={{ fontSize: 11, color: "#CBD5E1", flex: 1 }}>{t.name}</span>
              {t.area && <span style={{ ...S.chip("#3B82F6"), fontSize: 8, padding: "1px 6px" }}>{t.area}</span>}
            </div>)}
          </div>
        </div>
      )
    })}
  </div>);
}

/* ═══════════════════════════════════════════════════
   OPERATOR WORK HISTORY
   ═══════════════════════════════════════════════════ */
function OperatorWorkHistory({ ops, areas }) {
  const [selectedOp, setSelectedOp] = useState(ops[0]?.id || "");
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  useEffect(() => {
    if (!selectedOp) return;

    setLoading(true);
    getOperatorWorkStats(selectedOp, dateRange.start || null, dateRange.end || null)
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading work stats:', err);
        setLoading(false);
      });
  }, [selectedOp, dateRange]);

  const operator = ops.find(o => o.id === selectedOp);
  const totalWeeks = stats.reduce((sum, s) => sum + s.weeks_worked, 0);

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>📊 Operator Work History</h2>

      {/* Filters */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={S.lbl}>Operator</label>
            <select value={selectedOp} onChange={e => setSelectedOp(e.target.value)} style={{ ...S.inp, appearance: "auto" }}>
              {ops.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Start Date (Optional)</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} style={S.inp} />
          </div>
          <div>
            <label style={S.lbl}>End Date (Optional)</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} style={S.inp} />
          </div>
        </div>
      </div>

      {/* Summary Card */}
      {operator && (
        <div style={{ ...S.card, marginBottom: 20, background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(16,185,129,0.1) 100%)", borderLeft: "4px solid #3B82F6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{operator.name}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                {dateRange.start || dateRange.end ? `Filtered: ${dateRange.start || 'All'} to ${dateRange.end || 'All'}` : 'All Time'}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#3B82F6" }}>{totalWeeks}</div>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Total Weeks Worked</div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Table */}
      {loading ? (
        <div style={{ ...S.card, textAlign: "center", padding: 40, color: "#64748B" }}>
          Loading work history...
        </div>
      ) : stats.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 40, color: "#64748B" }}>
          No work history found for this operator in the selected date range.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {stats.map((stat, i) => {
            const area = areas.find(a => a.id === stat.area_id);
            const percentage = totalWeeks > 0 ? ((stat.weeks_worked / totalWeeks) * 100).toFixed(1) : 0;

            return (
              <div key={i} style={{ ...S.card, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{area?.name || stat.area_id}</div>
                    <div style={{ fontSize: 11, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
                      First: {stat.first_worked} • Last: {stat.last_worked}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 20 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#10B981" }}>{stat.weeks_worked}</div>
                    <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>weeks ({percentage}%)</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "#10B981", width: `${percentage}%`, transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TRAINING TRACKER (shift-specific)
   ═══════════════════════════════════════════════════ */
function Training({ ops, training, setTraining, areas }) {
  const [selOp, setSelOp] = useState(ops[0]?.id || "");
  const [selMod, setSelMod] = useState("L1");
  const tasks = SKAP_TASKS.filter(t => t.mod === selMod);
  const mod = SKAP_MODULES.find(m => m.id === selMod);
  const prog = selOp ? getSkapProgress(selOp, training) : [];
  const eligible = selOp ? getEligibleAreas(selOp, areas, ops, training) : [];
  const cycle = tid => { setTraining(p => { const o = { ...(p[selOp] || {}) }; const c = o[tid]; if (!c) o[tid] = "training"; else if (c === "training") o[tid] = "completed"; else delete o[tid]; return { ...p, [selOp]: o } }) };
  const markAllModule = (status) => { setTraining(p => { const o = { ...(p[selOp] || {}) }; tasks.forEach(t => { if (status) o[t.id] = status; else delete o[t.id] }); return { ...p, [selOp]: o } }) };
  const sc = { completed: "#10B981", training: "#F59E0B" };
  const sl = { completed: "✓ Completed", training: "◉ In Training" };
  return (<div>
    <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Training Tracker</h2>
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
      <div>
        <label style={S.lbl}>Operator</label>
        <select value={selOp} onChange={e => setSelOp(e.target.value)} style={{ ...S.inp, appearance: "auto", marginBottom: 14 }}>{ops.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <div style={{ ...S.card, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>SKAP Progress</div>
          {prog.map(p => <div key={p.id} style={{ marginBottom: 6, cursor: "pointer" }} onClick={() => setSelMod(p.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, marginBottom: 2 }}><span style={{ color: selMod === p.id ? p.color : "#94A3B8" }}>{p.id}: {p.name}</span><span style={{ color: p.pct === 100 ? "#10B981" : "#64748B" }}>{p.completed}/{p.total}</span></div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}><div style={{ height: "100%", borderRadius: 3, background: p.color, width: `${p.pct}%` }} /></div>
          </div>)}
        </div>
        <div style={{ ...S.card, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Area Eligibility</div>
          {areas.map(a => { const can = eligible.some(e => e.id === a.id); return <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><span style={{ fontSize: 11, fontWeight: 600 }}>{a.name}</span><span style={{ fontSize: 10, fontWeight: 700, color: can ? "#10B981" : "#EF4444" }}>{can ? "ELIGIBLE" : "NOT YET"}</span></div> })}
        </div>
      </div>
      <div style={{ ...S.card, borderLeft: `4px solid ${mod?.color || "#666"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: mod?.color }}>{mod?.id}: {mod?.name}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{tasks.length} tasks — click to cycle status</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => markAllModule("completed")} style={{ padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 9, fontFamily: "inherit", background: "rgba(16,185,129,0.15)", color: "#10B981" }}>✓ All Complete</button>
            <button onClick={() => markAllModule("training")} style={{ padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 9, fontFamily: "inherit", background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>◉ All Training</button>
            <button onClick={() => markAllModule(null)} style={{ padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 9, fontFamily: "inherit", background: "rgba(255,255,255,0.06)", color: "#94A3B8" }}>✕ Clear</button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          {tasks.map(t => {
            const s = training[selOp]?.[t.id] || null; return <div key={t.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", borderRadius: 5, background: s === "completed" ? "rgba(16,185,129,0.05)" : s === "training" ? "rgba(245,158,11,0.05)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: mod?.color, fontWeight: 700, minWidth: 48 }}>{t.id}</span>
              <span style={{ fontSize: 10, color: "#CBD5E1", flex: 1 }}>{t.name}</span>
              {t.area && <span style={{ ...S.chip("#3B82F6"), fontSize: 7, padding: "0 5px" }}>{t.area}</span>}
              <button onClick={() => cycle(t.id)} style={{ padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 9, fontFamily: "inherit", minWidth: 80, background: s ? `${sc[s]}22` : "rgba(255,255,255,0.06)", color: s ? sc[s] : "#475569" }}>{s ? sl[s] : "○ Not Started"}</button>
            </div>
          })}
        </div>
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════
   HOLIDAYS (shift-specific)
   ═══════════════════════════════════════════════════ */
function Hols({ hols, setHols, ops }) {
  const [f, sF] = useState({ opId: ops[0]?.id || "", start: "", end: "" });
  const addH = () => { if (!f.opId || !f.start || !f.end) return; setHols(p => [...p, { id: uid(), ...f }]); sF({ opId: ops[0]?.id || "", start: "", end: "" }) };
  return (<div>
    <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>Holidays</h2>
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 14, alignItems: "end" }}>
        <div><label style={S.lbl}>Operator</label><select value={f.opId} onChange={e => sF(p => ({ ...p, opId: e.target.value }))} style={{ ...S.inp, appearance: "auto" }}>{ops.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <div><label style={S.lbl}>Start</label><input type="date" value={f.start} onChange={e => sF(p => ({ ...p, start: e.target.value }))} style={S.inp} /></div>
        <div><label style={S.lbl}>End</label><input type="date" value={f.end} onChange={e => sF(p => ({ ...p, end: e.target.value }))} style={S.inp} /></div>
        <button onClick={addH} style={S.bp}><Ic.Plus /> Book</button>
      </div>
    </div>
    {!hols.length ? <div style={{ ...S.card, textAlign: "center", padding: 30, color: "#64748B" }}>No holidays booked.</div> :
      <div style={{ display: "grid", gap: 4 }}>{hols.sort((a, b) => a.start.localeCompare(b.start)).map(h => {
        const op = ops.find(o => o.id === h.opId); const days = Math.ceil((new Date(h.end) - new Date(h.start)) / 864e5) + 1; return <div key={h.id} style={{ ...S.card, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(239,68,68,0.15)", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10 }}>{op?.name?.split(" ").map(n => n[0]).join("")}</div><div><div style={{ fontWeight: 600, fontSize: 12 }}>{op?.name}</div><div style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono',monospace" }}>{h.start} → {h.end} ({days}d)</div></div></div>
          <button onClick={() => setHols(p => p.filter(x => x.id !== h.id))} style={{ ...S.bg, padding: 3, border: "none", color: "#EF4444" }}><Ic.Trash /></button>
        </div>
      })}</div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   OPERATOR SICKNESS TABLE
   ═══════════════════════════════════════════════════ */
function OperatorSicknessTable({ ops, shiftId, team }) {
  const [sicknessData, setSicknessData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editingStartDate, setEditingStartDate] = useState(null);
  const [startDateValue, setStartDateValue] = useState('');
  const [savedDates, setSavedDates] = useState({});
  const [debugLog, setDebugLog] = useState([]);

  useEffect(() => {
    loadSicknessData();
  }, [ops, shiftId]);

  const addDebug = (msg) => setDebugLog(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${msg}`]);

  const loadSicknessData = async () => {
    setLoading(true);
    addDebug(`Loading... shiftId=${shiftId}, ops=${ops?.length}`);
    try {
      const data = await getShiftSicknessOverview(shiftId, ops);
      setSicknessData(data);
      const withDates = data.filter(d => d.startDate);
      addDebug(`Loaded ${data.length} operators. ${withDates.length} have startDate.`);
    } catch (err) {
      addDebug(`ERROR loading: ${err.message}`);
      console.error('Error loading sickness data:', err);
    }
    setLoading(false);
  };

  const handleStartDateSave = async (opId) => {
    if (!startDateValue) return;
    const op = sicknessData.find(d => d.id === opId || d.operatorId === opId);
    const name = op?.name || '';
    addDebug(`Saving: id=${opId}, date=${startDateValue}, name=${name}, shift=${shiftId}`);
    const result = await updateOperatorStartDate(opId, startDateValue, name, shiftId);
    if (result.error) {
      addDebug(`SAVE ERROR: ${result.error.message}`);
    } else {
      addDebug(`Saved OK for ${name}`);
    }
    setSavedDates(prev => ({ ...prev, [opId]: startDateValue }));
    setEditingStartDate(null);
    setStartDateValue('');
    loadSicknessData();
  };

  const statusColors = {
    green: { bg: 'rgba(16,185,129,0.12)', color: '#10B981', label: 'GOOD' },
    amber: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'MONITOR' },
    red: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', label: 'INVESTIGATE' }
  };

  const filtered = filter === 'all' ? sicknessData : sicknessData.filter(d => d.status === filter);
  const fte = filtered.filter(op => !op.isAgency);
  const agency = filtered.filter(op => op.isAgency);

  const counts = {
    red: sicknessData.filter(d => d.status === 'red').length,
    amber: sicknessData.filter(d => d.status === 'amber').length,
    green: sicknessData.filter(d => d.status === 'green').length
  };

  if (loading) return <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748B' }}>Loading sickness data...</div>;

  const renderTable = (operators, title, titleColor) => (
    <div style={{ ...S.card, padding: 0, overflow: 'hidden', marginBottom: 16, borderLeft: titleColor ? `3px solid ${titleColor}` : undefined }}>
      {title && <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: 11, color: titleColor || '#94A3B8', textTransform: 'uppercase' }}>{title}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 70px 100px', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        <div>Operator</div>
        <div style={{ textAlign: 'center' }}>Tenure</div>
        <div style={{ textAlign: 'center' }}>Sick Days</div>
        <div style={{ textAlign: 'center' }}>Work Days</div>
        <div style={{ textAlign: 'center' }}>Rate</div>
        <div style={{ textAlign: 'center' }}>Status</div>
      </div>

      {operators.map((op, i) => {
        const sc = statusColors[op.status];
        return (
          <div key={op.id || i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 70px 100px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{op.name}</div>
              {editingStartDate === op.id ? (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input type="date" value={startDateValue} onChange={e => setStartDateValue(e.target.value)} style={{ ...S.inp, padding: '2px 6px', fontSize: 10, width: 130 }} />
                  <button onClick={() => handleStartDateSave(op.id)} style={{ ...S.bp, padding: '2px 8px', fontSize: 10 }}>Save</button>
                  <button onClick={() => setEditingStartDate(null)} style={{ ...S.bg, padding: '2px 8px', fontSize: 10 }}>✕</button>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#64748B', cursor: 'pointer' }} onClick={() => { setEditingStartDate(op.id); setStartDateValue(''); }}>
                  {(() => { const sd = savedDates[op.id] || op.startDate; return sd ? `Started: ${sd}` : '+ Set start date'; })()}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: op.hasStartDate ? 'inherit' : '#64748B' }}>{op.hasStartDate ? `${op.tenureYears}y` : '—'}</div>
            <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: op.sickDays > 0 ? '#EF4444' : '#64748B' }}>{op.sickDays}</div>
            <div style={{ textAlign: 'center', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#64748B' }}>{op.hasStartDate ? op.totalWorkDays.toLocaleString() : '—'}</div>
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: sc.color }}>{op.rate}%</div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: sc.bg, color: sc.color, letterSpacing: '0.5px' }}>{sc.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ ...S.card, marginBottom: 16, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🏥 Operator Sickness Tracking</h3>
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px' }}>5-year rolling absence rate · 2.5% investigation threshold</p>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.08)', cursor: 'pointer', border: filter === 'red' ? '2px solid #EF4444' : '2px solid transparent' }} onClick={() => setFilter(f => f === 'red' ? 'all' : 'red')}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#EF4444' }}>{counts.red}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#EF4444' }}>INVESTIGATE</div>
            <div style={{ fontSize: 9, color: '#64748B' }}>≥ 4%</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.08)', cursor: 'pointer', border: filter === 'amber' ? '2px solid #F59E0B' : '2px solid transparent' }} onClick={() => setFilter(f => f === 'amber' ? 'all' : 'amber')}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#F59E0B' }}>{counts.amber}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B' }}>MONITOR</div>
            <div style={{ fontSize: 9, color: '#64748B' }}>2.5% – 4%</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: 12, borderRadius: 8, background: 'rgba(16,185,129,0.08)', cursor: 'pointer', border: filter === 'green' ? '2px solid #10B981' : '2px solid transparent' }} onClick={() => setFilter(f => f === 'green' ? 'all' : 'green')}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{counts.green}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#10B981' }}>GOOD</div>
            <div style={{ fontSize: 9, color: '#64748B' }}>{'< 2.5%'}</div>
          </div>
        </div>

        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} style={{ ...S.bg, fontSize: 11, padding: '4px 12px', marginBottom: 12 }}>
            Show All ({sicknessData.length})
          </button>
        )}
      </div>

      {fte.length > 0 && renderTable(fte, "FTE Operators", team.color)}
      {agency.length > 0 && renderTable(agency, "Agency Workers", "#F59E0B")}

      {filtered.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#64748B' }}>
          {filter !== 'all' ? `No operators with ${filter} status` : 'No sickness data available. Upload staffing plans to populate.'}
        </div>
      )}

      {/* Refresh button */}
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button onClick={loadSicknessData} style={{ ...S.bg, fontSize: 11, padding: '6px 14px' }}>🔄 Refresh Data</button>
      </div>

      {/* Debug Log - temporary */}
      {debugLog.length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#94A3B8' }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#F59E0B' }}>🔍 Debug Log</div>
          {debugLog.map((msg, i) => <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{msg}</div>)}
        </div>
      )}
    </div>
  );
}

