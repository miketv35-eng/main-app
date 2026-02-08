import { genRota } from '../src/utils/rotaEngine.js';
import { fmt, ad } from '../src/utils/dateUtils.js';

const mockOps = [
    { id: 'op1', name: 'Op 1', isAgency: false, quals: ['area1'], prefArea: 'area1' },
    { id: 'op2', name: 'Op 2', isAgency: false, quals: ['area1'] },
    { id: 'ag1', name: 'Ag 1', isAgency: true, quals: ['area1'] }
];
const mockAreas = [
    { id: 'area1', name: 'Area 1', min: 1, type: 'fixed' }
];
const mockLines = [];
const mockTeam = { id: 'tA', name: 'Team A', color: 'red', anchor: '2024-01-01' }; // 2024-01-01 was Monday
const mockHols = [];
const weekStart = new Date('2024-01-01');
const prevAssign = {};
const training = {};
const machineStatus = {};
const loadingData = [];
const staffingPlan = { fte: {}, agency: [] };

try {
    console.log('Testing genRota...');
    const result = genRota(mockOps, mockAreas, mockLines, mockTeam, mockHols, weekStart, prevAssign, training, machineStatus, loadingData, staffingPlan);
    console.log('Result keys:', Object.keys(result));
    // Check if grid has entries
    const days = Object.keys(result.grid);
    console.log('Grid days:', days.length);

    if (result.assigns && result.grid && days.length === 4) { // 4 working days in a week cycle usually? Or 7 days grid?
        // The engine generates grid for 7 days, but assigns only for working days.
        // Logic: dates.forEach ... inWeek ...
        console.log('SUCCESS: Rota generated.');
    } else {
        console.error('FAILURE: Invalid result format. Days:', days.length);
        console.log('Grid:', JSON.stringify(result.grid, null, 2));
        process.exit(1);
    }
} catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
}
