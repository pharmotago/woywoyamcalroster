import supabase from './supabase-client.js';

export const SwapDB = {
  getSwaps: async () => {
    const { data, error } = await supabase.from('brisk_shift_swaps').select('*');
    if (error) {
      console.error('Error fetching swaps', error);
      return [];
    }
    return (data || []).map(s => ({
      id: s.id,
      shiftId: s.shift_id,
      requestingEmployeeId: s.requester_id || s.requesting_employee_id,
      coveringEmployeeId: s.acceptor_id || s.covering_employee_id,
      status: s.status,
      createdAt: s.created_at
    }));
  },
  createSwap: async (shiftId, requestingEmployeeId) => {
    if (!shiftId || !requestingEmployeeId) throw new Error('shiftId and requestingEmployeeId are required.');

    // Check for existing pending swap on same shift
    const { data: existing } = await supabase.from('brisk_shift_swaps')
      .select('id')
      .eq('shift_id', shiftId)
      .or('status.eq.Pending,status.eq.PENDING');
    if (existing && existing.length > 0) throw new Error('A pending swap request already exists for this shift.');

    const { data, error } = await supabase.from('brisk_shift_swaps').insert([{
      shift_id: shiftId,
      requester_id: requestingEmployeeId,
      status: 'Pending'
    }]).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Failed to create swap");
    const s = data[0];
    return {
      id: s.id,
      shiftId: s.shift_id,
      requestingEmployeeId: s.requester_id || s.requesting_employee_id,
      coveringEmployeeId: s.acceptor_id || s.covering_employee_id,
      status: s.status,
      createdAt: s.created_at
    };
  },
  cancelSwap: async (shiftId, requestingEmployeeId) => {
    // Build query — if requestingEmployeeId provided, scope deletion to that user
    let query = supabase.from('brisk_shift_swaps')
      .delete()
      .eq('shift_id', shiftId)
      .or('status.eq.Pending,status.eq.PENDING');
    if (requestingEmployeeId) {
      query = query.eq('requester_id', requestingEmployeeId);
    }
    const { error } = await query;
    if (error) throw error;
  },
  coverSwap: async (shiftId, coveringEmployeeId) => {
    if (!shiftId || !coveringEmployeeId) throw new Error('shiftId and coveringEmployeeId are required.');

    // 1. FIRST: Read the pending swap WITHOUT mutating it
    const { data: pendingSwaps, error: readErr } = await supabase.from('brisk_shift_swaps')
      .select('*')
      .eq('shift_id', shiftId)
      .or('status.eq.Pending,status.eq.PENDING');
    if (readErr) throw readErr;
    if (!pendingSwaps || pendingSwaps.length === 0) throw new Error("Swap no longer available or already covered.");
    const s = pendingSwaps[0];

    // 2. Validate BEFORE writing — prevent accepting own swap
    if ((s.requester_id && s.requester_id === coveringEmployeeId) || (s.requesting_employee_id && s.requesting_employee_id === coveringEmployeeId)) {
      throw new Error("You cannot accept your own shift swap request.");
    }

    // 3. NOW update the swap record (validation passed)
    const { error: updateErr } = await supabase.from('brisk_shift_swaps')
      .update({ acceptor_id: coveringEmployeeId, status: 'Accepted' })
      .eq('id', s.id);
    if (updateErr) throw updateErr;

    // 4. Reassign the shift to the covering employee
    await supabase.from('brisk_shifts')
      .update({ employee_id: coveringEmployeeId })
      .eq('id', shiftId);

    return {
      id: s.id,
      shiftId: s.shift_id,
      requestingEmployeeId: s.requester_id || s.requesting_employee_id,
      coveringEmployeeId: coveringEmployeeId,
      status: 'Accepted',
      createdAt: s.created_at
    };
  }
};
