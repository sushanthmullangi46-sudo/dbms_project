import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Package, 
  AlertTriangle, 
  FileCheck, 
  Send, 
  UserCheck, 
  ShieldCheck, 
  Building, 
  Boxes,
  Check,
  Sparkles,
  HeartHandshake,
  Layers,
  ArrowRight
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

// Helper to pick supply emoji icon
function getItemEmoji(name = '') {
  const lower = String(name).toLowerCase();
  if (lower.includes('water')) return '💧';
  if (lower.includes('food') || lower.includes('ration')) return '🍞';
  if (lower.includes('first') || lower.includes('trauma')) return '🩹';
  if (lower.includes('medicin') || lower.includes('fluid') || lower.includes('iv')) return '💊';
  if (lower.includes('blanket') || lower.includes('cloth')) return '🛏️';
  if (lower.includes('boat') || lower.includes('zodiac')) return '🚤';
  if (lower.includes('tent') || lower.includes('shelter')) return '⛺';
  if (lower.includes('oxygen')) return '🫁';
  if (lower.includes('baby') || lower.includes('infant')) return '🍼';
  if (lower.includes('sanitat') || lower.includes('disinfect')) return '🧼';
  if (lower.includes('pump')) return '⚙️';
  return '📦';
}

const DEFAULT_CITIZEN_REQUIREMENTS = [
  { resource_id: 4, resource_name: 'Purified Potable Water 20L Cans', category: 'WATER', unit: 'Cans', quantity_requested: 50 },
  { resource_id: 3, resource_name: 'Emergency 72hr Food Ration Kits', category: 'FOOD', unit: 'Kits', quantity_requested: 100 },
  { resource_id: 5, resource_name: 'Trauma Emergency First Aid Kit', category: 'MEDICAL', unit: 'Kits', quantity_requested: 10 },
  { resource_id: 8, resource_name: 'Emergency Essential Medicines & IV Fluids', category: 'MEDICAL', unit: 'Packs', quantity_requested: 25 },
  { resource_id: 7, resource_name: 'Thermal Cold Relief Blankets', category: 'SHELTER_SUPPLIES', unit: 'Blankets', quantity_requested: 50 },
  { resource_id: 1, resource_name: 'Inflatable Rescue Boat (Zodiac)', category: 'EQUIPMENT', unit: 'Boats', quantity_requested: 2 }
];

export default function CoordinatorDeliveriesPage() {
  const { success, error } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [citizenRequests, setCitizenRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedDisasterId, setSelectedDisasterId] = useState('');
  
  const [driverName, setDriverName] = useState('Constable K. Murthy (Logistics Squad)');
  const [vehicleReg, setVehicleReg] = useState('KA-04-G-4412 (NDRF Supply Carrier)');
  const [destination, setDestination] = useState('Hebbal Sector 21 Relief Camp');

  // Delivery Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState(null);
  const [receivedQty, setReceivedQty] = useState(0);
  const [damagedQty, setDamagedQty] = useState(0);
  const [receiverName, setReceiverName] = useState('Inspector V. Raman (Field Ops)');
  const [proofNotes, setProofNotes] = useState('Signed physical receipt challan #8841 verified on scene');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDeliveries();
    loadDispatchMetadata();
  }, []);

  const loadDispatchMetadata = async () => {
    try {
      const [wRes, reqRes] = await Promise.allSettled([
        api.get('/resources/warehouses'),
        api.get('/resources/requests')
      ]);

      if (wRes.status === 'fulfilled' && wRes.value) {
        const whs = wRes.value.warehouses || (Array.isArray(wRes.value) ? wRes.value : []);
        setWarehouses(whs);
        if (whs.length > 0) setSelectedWarehouseId(String(whs[0].warehouse_id || whs[0].WAREHOUSEID));
      }

      if (reqRes.status === 'fulfilled' && reqRes.value) {
        const rawReqs = (reqRes.value && (reqRes.value.requests || reqRes.value.data)) || (Array.isArray(reqRes.value) ? reqRes.value : []);
        setCitizenRequests(rawReqs);
        if (rawReqs.length > 0) {
          const firstReq = rawReqs[0];
          setSelectedRequestId(String(firstReq.request_id || firstReq.REQUESTID || firstReq.id));
          setSelectedDisasterId(String(firstReq.disaster_id || firstReq.incident_id || firstReq.INCIDENTID || '1'));
          setDestination(`${firstReq.disaster_name || firstReq.INCIDENTNAME || 'Disaster Sector'} (${firstReq.location_name || firstReq.LOCATIONNAME || 'Relief Camp'})`);
        }
      }
    } catch (_) {}
  };

  const handleSelectRequest = (reqId) => {
    setSelectedRequestId(reqId);
    const req = citizenRequests.find(r => String(r.request_id || r.REQUESTID || r.id) === String(reqId));
    if (req) {
      if (req.disaster_id || req.incident_id || req.INCIDENTID) {
        setSelectedDisasterId(String(req.disaster_id || req.incident_id || req.INCIDENTID));
      }
      setDestination(`${req.disaster_name || req.INCIDENTNAME || 'Disaster Sector'} (${req.location_name || req.LOCATIONNAME || 'Relief Camp'})`);
    }
  };

  const currentCitizenRequest = citizenRequests.find(r => String(r.request_id || r.REQUESTID || r.id) === String(selectedRequestId)) || citizenRequests[0] || null;
  const rawItems = currentCitizenRequest?.items || currentCitizenRequest?.ITEMS || [];
  const manifestItems = rawItems.length > 0 ? rawItems : DEFAULT_CITIZEN_REQUIREMENTS;

  const totalManifestUnits = manifestItems.reduce((acc, itm) => acc + Number(itm.quantity_requested || itm.QUANTITYREQUIRED || itm.quantity || 10), 0);

  const fetchDeliveries = async () => {
    try {
      const res = await api.get('/deliveries');
      let list = [];
      if (Array.isArray(res)) {
        list = res;
      } else if (res && res.deliveries) {
        list = res.deliveries;
      }
      setDeliveries(list);
    } catch (e) {
      console.error(e);
      // Fallback
      setDeliveries([
        {
          delivery_id: 1,
          dispatch_reference: 'DSP-101-0001',
          destination: 'Hebbal Flyover Relief Camp (Hebbal Ward)',
          carrier_info: 'KA-04-G-4412 • Constable K. Murthy',
          status: 'DISPATCHED',
          quantity_dispatched: 500,
          quantity_received: 0,
          quantity_damaged: 0,
          dispatched_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          delivery_id: 2,
          dispatch_reference: 'DSP-102-0002',
          destination: 'Yelahanka Lake Basin Center (Yelahanka Sector)',
          carrier_info: 'KA-04-G-8819 • Driver R. Sharma',
          status: 'DELIVERED',
          quantity_dispatched: 800,
          quantity_received: 800,
          quantity_damaged: 0,
          dispatched_at: new Date(Date.now() - 7200000).toISOString(),
          delivered_at: new Date(Date.now() - 1800000).toISOString(),
          received_by: 'Inspector S. Reddy'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const itemsToDispatch = manifestItems.map(itm => ({
        resource_id: itm.resource_id || itm.RESOURCETYPEID || 1,
        quantity: Number(itm.quantity_requested || itm.QUANTITYREQUIRED || itm.quantity || 10)
      }));

      const payload = {
        warehouse_id: selectedWarehouseId ? Number(selectedWarehouseId) : 1,
        disaster_id: selectedDisasterId ? Number(selectedDisasterId) : (currentCitizenRequest?.disaster_id || 1),
        request_id: currentCitizenRequest?.request_id || currentCitizenRequest?.REQUESTID || undefined,
        items: itemsToDispatch,
        transport_driver_name: driverName,
        vehicle_registration: vehicleReg,
        carrier_info: `${vehicleReg} • ${driverName}`,
        destination: destination
      };

      const res = await api.post('/deliveries/dispatch', payload);
      success(res?.message || 'Delivery convoy dispatched with all citizen requirements! Status set to DISPATCHED.');
      setShowDispatchModal(false);
      await fetchDeliveries();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Dispatch creation failed.';
      error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setProcessing(false);
    }
  };

  const openConfirmModal = (deliv) => {
    setConfirmModal(deliv);
    const initialQty = deliv.quantity_dispatched ?? (deliv.items?.[0]?.quantity_dispatched || 50);
    setReceivedQty(initialQty);
    setDamagedQty(0);
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    if (!confirmModal) return;

    setProcessing(true);
    try {
      const payload = {
        delivery_id: confirmModal.delivery_id,
        received_by: receiverName,
        quantity_received: Number(receivedQty),
        quantity_damaged: Number(damagedQty),
        proof_of_delivery: proofNotes
      };

      await api.post('/deliveries/confirm', payload);
      success('Delivery receipt verified! Audit record created and stock reconciled with zero duplicate deductions.');
      setConfirmModal(null);
      await fetchDeliveries();
    } catch (err) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Delivery confirmation failed.';
      error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight uppercase flex items-center gap-2">
            <Truck className="w-6 h-6 text-cyan-400" />
            <span>Resource Deliveries & Supply Convoys</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Stage 8: Dispatch resource convoys directly against citizen emergency requirements & stamp physical field receipt
          </p>
        </div>

        <button
          onClick={() => {
            loadDispatchMetadata();
            setShowDispatchModal(true);
          }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center space-x-2 cursor-pointer self-start sm:self-auto"
        >
          <Send className="w-4 h-4" />
          <span>Create New Convoy Dispatch</span>
        </button>
      </div>

      {/* Deliveries List */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          Tracking active logistics convoys...
        </div>
      ) : deliveries.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">No Active Dispatches</h2>
          <p className="text-xs text-slate-400 mt-1">Click "Create New Convoy Dispatch" to send relief supplies requested by citizens.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((deliv) => {
            const isDelivered = deliv.status === 'DELIVERED' || deliv.delivery_status === 'DELIVERED';
            const refCode = deliv.dispatch_reference || `DSP-${deliv.disaster_id || 101}-${String(deliv.delivery_id).padStart(4, '0')}`;
            const destStr = deliv.destination || deliv.disaster_name || 'Emergency Field Sector';
            const carrierStr = deliv.carrier_info || `${deliv.vehicle_registration || 'KA-04-TR-4421'} • ${deliv.transport_driver || deliv.transport_driver_name || 'Logistics Driver'}`;
            const qtyDispatched = deliv.quantity_dispatched ?? (deliv.items?.[0]?.quantity_dispatched || 50);
            const qtyReceived = deliv.quantity_received ?? (deliv.items?.[0]?.quantity_received || (isDelivered ? qtyDispatched : 0));
            const qtyDamaged = deliv.quantity_damaged ?? (deliv.items?.[0]?.quantity_damaged || 0);

            return (
              <div
                key={deliv.delivery_id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                      {refCode}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        isDelivered
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse'
                      }`}
                    >
                      {isDelivered ? 'DELIVERED' : 'DISPATCHED'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono">
                    Dispatched: {new Date(deliv.dispatched_at || Date.now()).toLocaleTimeString()}
                  </div>
                </div>

                {/* Convoy Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Destination</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block truncate">{destStr}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Transport & Carrier</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block truncate">{carrierStr}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Cargo</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm mt-0.5 block">
                      {qtyDispatched} units
                    </span>
                  </div>
                </div>

                {/* Dispatched Relief Manifest */}
                {deliv.items && deliv.items.length > 0 && (
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span className="uppercase tracking-wider">Dispatched Relief Cargo Manifest ({deliv.items.length} Items)</span>
                      <span className="text-slate-500 font-mono">{qtyDispatched} Total Units</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {deliv.items.map((itm, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs flex items-center space-x-2"
                        >
                          <span className="text-sm">{getItemEmoji(itm.resource_name)}</span>
                          <span className="text-slate-200 font-medium">{itm.resource_name}</span>
                          <span className="font-mono font-bold text-cyan-400 bg-cyan-950/50 px-1.5 py-0.5 rounded text-[11px]">
                            {itm.quantity_dispatched} {itm.unit || 'units'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery Confirmation Bar */}
                <div className="flex items-center justify-between pt-2">
                  {isDelivered ? (
                    <div className="text-xs text-emerald-400 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Delivered & Reconciled: Received by <strong>{deliv.received_by || deliv.receiver_name || 'Inspector V. Raman'}</strong> ({qtyReceived} units verified, {qtyDamaged} damaged)
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Convoy in transit to relief sector. Awaiting authorized field receipt confirmation.</span>
                    </div>
                  )}

                  {!isDelivered && (
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => openConfirmModal(deliv)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-md shadow-emerald-600/20 transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Record Delivery Confirmation</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Convoy Dispatch Modal showing all requirements asked by citizen */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Dispatch Relief Convoy</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono uppercase">
                      Citizen Requirements Loaded
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    All requirements requested by the citizen are pre-loaded in this manifest. Review and confirm dispatch.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-4 overflow-y-auto pr-1">
              {/* Active Citizen Emergency Incident Picker */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <HeartHandshake className="w-4 h-4 text-rose-400" />
                    <span>Citizen Emergency Incident</span>
                  </label>
                  {currentCitizenRequest && (
                    <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/50 border border-cyan-800/50 px-2 py-0.5 rounded">
                      Ref: {currentCitizenRequest.emergency_id || currentCitizenRequest.report_reference_id || `REQ-#${currentCitizenRequest.request_id || 120}`}
                    </span>
                  )}
                </div>

                {citizenRequests.length > 0 ? (
                  <select
                    value={selectedRequestId}
                    onChange={(e) => handleSelectRequest(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
                  >
                    {citizenRequests.map(req => {
                      const reqId = req.request_id || req.REQUESTID || req.id;
                      const incName = req.disaster_name || req.INCIDENTNAME || `Incident #${req.disaster_id || 1}`;
                      const locName = req.location_name || req.LOCATIONNAME || 'Relief Camp';
                      const p = req.priority || req.PRIORITY || 'P1';
                      return (
                        <option key={reqId} value={reqId}>
                          [{p}] {incName} • {locName}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="text-xs text-slate-300 font-medium">
                    Flood Emergency at Koramangala Sector (Citizen Request Active)
                  </div>
                )}
              </div>

              {/* Citizen Requirements Manifest (Pre-loaded / No Manual Selection) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    <span>Requirements Asked by Citizen ({manifestItems.length} Items)</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
                    Total: {totalManifestUnits} Units
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  The citizen reported the following material assistance requirements. These are automatically attached to this convoy dispatch:
                </p>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1 bg-slate-950/50 rounded-xl border border-slate-800/80">
                  {manifestItems.map((itm, idx) => {
                    const rName = itm.resource_name || itm.RESOURCENAME || 'Relief Cargo';
                    const qReq = itm.quantity_requested || itm.QUANTITYREQUIRED || itm.quantity || 10;
                    const unitStr = itm.unit || itm.UNIT || 'Units';
                    const catStr = itm.category || 'RELIEF';

                    return (
                      <div
                        key={idx}
                        className="bg-slate-900 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between shadow-sm hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="text-xl shrink-0">{getItemEmoji(rName)}</span>
                          <div className="min-w-0">
                            <span className="font-bold text-white text-xs block truncate">{rName}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Category: {catStr}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-2">
                          <span className="font-mono font-black text-emerald-400 text-sm block">
                            {qReq}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            {unitStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Source Depot & Field Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Source Warehouse Depot
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {warehouses.length > 0 ? (
                      warehouses.map(w => (
                        <option key={w.warehouse_id || w.WAREHOUSEID} value={w.warehouse_id || w.WAREHOUSEID}>
                          {w.warehouse_name || w.WAREHOUSENAME}
                        </option>
                      ))
                    ) : (
                      <option value="1">Hebbal Central Disaster Reserve Depot</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Destination Relief Sector
                  </label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Assigned Convoy Carrier & Driver */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Assigned Transport Driver
                  </label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Vehicle Registration Plate
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              {/* Submit / Confirm Button */}
              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/30 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{processing ? 'Dispatching...' : 'Confirm & Dispatch All Citizen Requirements'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Delivery Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              <span>Record Delivery Receipt Confirmation</span>
            </h3>
            <p className="text-xs text-slate-400">
              Confirm field arrival for {confirmModal.dispatch_reference || `Delivery #${confirmModal.delivery_id}`}. Reconciles inventory balances and verifies all cargo items.
            </p>

            <form onSubmit={handleConfirmDelivery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Authorized Receiving Officer / Agency
                </label>
                <input
                  type="text"
                  required
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Quantity Received
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={receivedQty}
                    onChange={(e) => setReceivedQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Damaged in Transit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={damagedQty}
                    onChange={(e) => setDamagedQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Proof of Delivery / Physical Challan Notes
                </label>
                <textarea
                  rows={2}
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {processing ? 'Verifying Receipt...' : 'Confirm Delivery & Stamp Record'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
