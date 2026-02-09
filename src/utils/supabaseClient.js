import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://nuxntitedixiijtxzuni.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eG50aXRlZGl4aWlqdHh6dW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTQzMjQsImV4cCI6MjA4NTk3MDMyNH0.Wpzpo2_KE07S7xe7SEQQsaRTff6YAAJeiMDz1JRJaak";

export const supabase = createClient(SUPA_URL, SUPA_KEY);

/**
 * Fetch operators for a specific shift.
 * @returns {Promise<Array>}
 */
export async function getOperators(shiftId) {
    const query = supabase.from("operators").select("*");
    if (shiftId) query.eq("shift_id", shiftId);

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching operators:", error);
        return [];
    }
    return data || [];
}

/**
 * Save or update operator data.
 */
export async function saveOperator(operator) {
    const { error } = await supabase.from("operators").upsert(operator);
    if (error) console.error("Error saving operator:", error);
}

/**
 * Mass update operators (e.g. sync from settings)
 */
export async function saveOperators(operators) {
    const { error } = await supabase.from("operators").upsert(operators);
    if (error) console.error("Error saving operators:", error);
}

/**
 * Fetch Rota for a specific date and shift.
 */
export async function getRota(date, shiftId) {
    const { data, error } = await supabase
        .from("rotas")
        .select("assignments")
        .eq("date", date)
        .eq("shift_id", shiftId)
        .single();

    if (error && error.code !== "PGRST116") {
        console.error("Error fetching rota:", error);
    }
    return data?.assignments || null;
}

/**
 * Save Rota assignments.
 */
export async function saveRota(date, shiftId, assignments) {
    const { error } = await supabase
        .from("rotas")
        .upsert({ date, shift_id: shiftId, assignments });

    if (error) console.error("Error saving rota:", error);
}

/**
 * Fetch Production Plan (Line Status & Products).
 */
export async function getProductionPlan(date) {
    const { data, error } = await supabase
        .from("production_plans")
        .select("line_status, products")
        .eq("date", date)
        .single();

    return data || { line_status: null, products: null };
}

/**
 * Save Production Plan Status.
 */
export async function saveLineStatus(date, status) {
    // upsert needs full row or we might overwrite products with null if not careful, 
    // but supabase upsert merges if we don't specify all columns? No, it replaces usually.
    // Actually basic SQL upsert replaces.
    // We should do a patch-like approach or just fetch-merge-save, OR separated updates.
    // For simplicity: We will rely on 'upsert' merging if we pass only the changed field?
    // Supabase JS upsert replaces the row by default unless we use 'ignoreDuplicates', which isn't what we want.
    // We'll use standard 'update' if exists, 'insert' if not. 
    // Actually, easiest is to ensure we pass both, OR check existence.

    // Better strategy: Use explicit UPDATE for partials, and INSERT if missing.
    // But for now, let's just assume we might overwrite if we don't return everything.
    // Wait, Supabase allows partial update if we use 'update' with match.

    const { data } = await supabase.from("production_plans").select("*").eq("date", date).single();

    const payload = { date, line_status: status };
    if (data?.products) payload.products = data.products; // Preserve existing

    const { error } = await supabase.from("production_plans").upsert(payload);
    if (error) console.error("Error saving line status:", error);
}

export async function savePlanProducts(date, products) {
    const { data } = await supabase.from("production_plans").select("*").eq("date", date).single();

    const payload = { date, products };
    if (data?.line_status) payload.line_status = data.line_status; // Preserve existing

    const { error } = await supabase.from("production_plans").upsert(payload);
    if (error) console.error("Error saving products:", error);
}

/**
 * Fetch Staffing Plan.
 */
export async function getStaffingPlan(weekDate) {
    const { data, error } = await supabase
        .from("staffing_plans")
        .select("data")
        .eq("week_date", weekDate)
        .single();

    return data?.data || null;
}

/**
 * Save Staffing Plan.
 */
export async function saveStaffingPlan(weekDate, planData) {
    const { error } = await supabase
        .from("staffing_plans")
        .upsert({ week_date: weekDate, data: planData });

    if (error) console.error("Error saving staffing plan:", error);
}

// Bulk fetch for initialization
export async function getAllPlans(startDate, endDate) {
    const { data } = await supabase
        .from("production_plans")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);

    // Transform to object keyed by date
    const statusMap = {};
    const productsMap = {};
    data?.forEach(row => {
        if (row.line_status) statusMap[row.date] = row.line_status;
        if (row.products) productsMap[row.date] = row.products;
    });
    return { statusMap, productsMap };
}

/**
 * Save rotation history for an operator's weekly assignment.
 */
export async function saveRotationHistory(operatorId, weekDate, areaId, hoursWorked, shiftId) {
    const { error } = await supabase
        .from('rotation_history')
        .upsert({
            operator_id: operatorId,
            week_date: weekDate,
            area_id: areaId,
            hours_worked: hoursWorked,
            shift_id: shiftId
        });
    if (error) console.error('Error saving rotation history:', error);
}

/**
 * Get rotation history for a specific operator.
 * @param {string} operatorId - Operator ID
 * @param {number} weeksBack - Number of weeks to look back (default 8)
 * @returns {Promise<Array>} Rotation history records
 */
export async function getRotationHistory(operatorId, weeksBack = 8) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));

    const { data, error } = await supabase
        .from('rotation_history')
        .select('*')
        .eq('operator_id', operatorId)
        .gte('week_date', cutoffDate.toISOString().split('T')[0])
        .order('week_date', { ascending: false });

    if (error) {
        console.error('Error fetching rotation history:', error);
        return [];
    }
    return data || [];
}

/**
 * Get all rotation history for training plan analysis.
 * @param {number} weeksBack - Number of weeks to look back (default 12)
 * @returns {Promise<Array>} All rotation history records
 */
export async function getAllRotationHistory(weeksBack = 12) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7));

    const { data, error } = await supabase
        .from('rotation_history')
        .select('*')
        .gte('week_date', cutoffDate.toISOString().split('T')[0])
        .order('week_date', { ascending: false });

    if (error) {
        console.error('Error fetching all rotation history:', error);
        return [];
    }
    return data || [];
}

