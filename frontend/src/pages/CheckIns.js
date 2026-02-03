import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Bell, Plus, Trash2, AlertTriangle, CheckCircle, X, ExternalLink, Shield, Wifi, WifiOff, Map } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker, Circle, InfoWindow } from '@react-google-maps/api';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const GOOGLE_MAPS_API_KEY = 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Placeholder - user needs to add their key

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '16px'
};

const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // NYC default

export default function CheckIns({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [showAddGeofence, setShowAddGeofence] = useState(false);
  const [newGeofence, setNewGeofence] = useState({ name: '', latitude: '', longitude: '', radius_feet: 50 });
  const [selectedChild, setSelectedChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showMap, setShowMap] = useState(true);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places']
  });

  useEffect(() => {
    initializeLocation();
    fetchData();
  }, []);

  const initializeLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(loc);
          setMapCenter(loc);
          setGpsEnabled(true);
          sendLocationUpdate(loc.lat, loc.lng);
        },
        (error) => {
          console.error('Location error:', error);
          setGpsEnabled(false);
          toast.error('Please enable location services');
        },
        { enableHighAccuracy: true }
      );

      // Watch position
      navigator.geolocation.watchPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(loc);
          setGpsEnabled(true);
          sendLocationUpdate(loc.lat, loc.lng);
        },
        (error) => {
          setGpsEnabled(false);
          if (currentLocation) {
            reportGpsDisabled(currentLocation.lat, currentLocation.lng);
          }
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
      );
    }
  };

  const fetchData = async () => {
    try {
      const [membersRes, geofencesRes, notificationsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/family/members`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/geofences`, { credentials: 'include' }),
        fetch(`${BACKEND_URL}/api/notifications`, { credentials: 'include' })
      ]);

      const members = await membersRes.json();
      const geofencesData = await geofencesRes.json();
      const notificationsData = await notificationsRes.json();

      const childMembers = (members.members || []).filter(m => m.role === 'child');
      setChildren(childMembers);
      setGeofences(geofencesData.geofences || []);
      setNotifications((notificationsData.notifications || []).filter(n => 
        n.type === 'geofence_exit' || n.type === 'gps_disabled'
      ));

      if (childMembers.length > 0 && !selectedChild) {
        setSelectedChild(childMembers[0]);
        fetchChildCheckins(childMembers[0].user_id);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const fetchChildCheckins = async (childId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/checkins/${childId}`, { credentials: 'include' });
      const data = await res.json();
      setCheckins(data.checkins || []);
      
      // Center map on last checkin
      if (data.checkins && data.checkins.length > 0) {
        setMapCenter({
          lat: data.checkins[0].latitude,
          lng: data.checkins[0].longitude
        });
      }
    } catch (error) {
      console.error('Failed to fetch checkins:', error);
    }
  };

  const sendLocationUpdate = async (lat, lng, isOffline = false) => {
    try {
      await fetch(`${BACKEND_URL}/api/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ latitude: lat, longitude: lng, is_offline_update: isOffline })
      });
    } catch (error) {
      console.error('Failed to send location:', error);
    }
  };

  const reportGpsDisabled = async (lastLat, lastLng) => {
    try {
      await fetch(`${BACKEND_URL}/api/location/gps-disabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ last_latitude: lastLat, last_longitude: lastLng })
      });
    } catch (error) {
      console.error('Failed to report GPS disabled:', error);
    }
  };

  const handleAddGeofence = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/geofences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newGeofence,
          latitude: parseFloat(newGeofence.latitude),
          longitude: parseFloat(newGeofence.longitude)
        })
      });
      toast.success('Safe zone created!');
      setShowAddGeofence(false);
      setNewGeofence({ name: '', latitude: '', longitude: '', radius_feet: 50 });
      fetchData();
    } catch (error) {
      toast.error('Failed to create safe zone');
    }
  };

  const handleDeleteGeofence = async (geofenceId) => {
    try {
      await fetch(`${BACKEND_URL}/api/geofences/${geofenceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      toast.success('Safe zone deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const useCurrentLocation = () => {
    if (currentLocation) {
      setNewGeofence({
        ...newGeofence,
        latitude: currentLocation.lat.toString(),
        longitude: currentLocation.lng.toString()
      });
    }
  };

  const openInMaps = (lat, lng) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const onMapClick = useCallback((e) => {
    if (showAddGeofence) {
      setNewGeofence({
        ...newGeofence,
        latitude: e.latLng.lat().toString(),
        longitude: e.latLng.lng().toString()
      });
    }
  }, [showAddGeofence, newGeofence]);

  const feetToMeters = (feet) => feet * 0.3048;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 space-y-4" data-testid="checkins-page">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">Location</h1>
              <p className="text-sm text-slate-400">Track and manage family locations</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowMap(!showMap)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1 ${showMap ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                <Map className="w-3 h-3" />
                <span>Map</span>
              </button>
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${gpsEnabled ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {gpsEnabled ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400 font-bold">GPS Active</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400 font-bold">GPS Off</span>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Google Map */}
          {showMap && (
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Map className="w-4 h-4 text-primary" />
                  <span>Family Map</span>
                </h2>
                {showAddGeofence && (
                  <p className="text-xs text-accent">Click on map to set location</p>
                )}
              </div>
              
              {loadError ? (
                <div className="h-[300px] bg-slate-800 rounded-2xl flex items-center justify-center">
                  <p className="text-slate-400 text-sm">Map requires Google Maps API key</p>
                </div>
              ) : !isLoaded ? (
                <div className="h-[300px] bg-slate-800 rounded-2xl flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={14}
                  onClick={onMapClick}
                  options={{
                    styles: [
                      { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
                      { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
                      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
                    ],
                    disableDefaultUI: true,
                    zoomControl: true
                  }}
                >
                  {/* Current Location Marker */}
                  {currentLocation && (
                    <Marker
                      position={currentLocation}
                      icon={{
                        path: window.google?.maps?.SymbolPath?.CIRCLE,
                        scale: 10,
                        fillColor: '#3B82F6',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 3
                      }}
                      onClick={() => setSelectedMarker({ type: 'current', ...currentLocation })}
                    />
                  )}

                  {/* Child's Last Location */}
                  {checkins.length > 0 && selectedChild && (
                    <Marker
                      position={{ lat: checkins[0].latitude, lng: checkins[0].longitude }}
                      icon={{
                        path: window.google?.maps?.SymbolPath?.CIRCLE,
                        scale: 8,
                        fillColor: '#F59E0B',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2
                      }}
                      onClick={() => setSelectedMarker({ type: 'child', name: selectedChild.name, ...checkins[0] })}
                    />
                  )}

                  {/* Geofence Circles */}
                  {geofences.map(fence => (
                    <React.Fragment key={fence.geofence_id}>
                      <Circle
                        center={{ lat: fence.latitude, lng: fence.longitude }}
                        radius={feetToMeters(fence.radius_feet)}
                        options={{
                          fillColor: '#22C55E',
                          fillOpacity: 0.2,
                          strokeColor: '#22C55E',
                          strokeOpacity: 0.8,
                          strokeWeight: 2
                        }}
                      />
                      <Marker
                        position={{ lat: fence.latitude, lng: fence.longitude }}
                        icon={{
                          path: window.google?.maps?.SymbolPath?.CIRCLE,
                          scale: 6,
                          fillColor: '#22C55E',
                          fillOpacity: 1,
                          strokeColor: '#fff',
                          strokeWeight: 2
                        }}
                        onClick={() => setSelectedMarker({ type: 'fence', ...fence })}
                      />
                    </React.Fragment>
                  ))}

                  {/* Info Window */}
                  {selectedMarker && (
                    <InfoWindow
                      position={{ lat: selectedMarker.latitude || selectedMarker.lat, lng: selectedMarker.longitude || selectedMarker.lng }}
                      onCloseClick={() => setSelectedMarker(null)}
                    >
                      <div className="p-2 text-slate-900">
                        {selectedMarker.type === 'current' && <p className="font-bold">Your Location</p>}
                        {selectedMarker.type === 'child' && <p className="font-bold">{selectedMarker.name}'s Last Location</p>}
                        {selectedMarker.type === 'fence' && (
                          <>
                            <p className="font-bold">{selectedMarker.name}</p>
                            <p className="text-sm">Safe Zone ({selectedMarker.radius_feet}ft)</p>
                          </>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              )}
            </div>
          )}

          {/* Location Alerts */}
          {notifications.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <Bell className="w-4 h-4 text-accent" />
                <span>Recent Alerts</span>
              </h2>
              {notifications.slice(0, 3).map(notif => (
                <div key={notif.notification_id} className={`glass-card rounded-xl p-3 flex items-center space-x-3 border-l-4 ${
                  notif.type === 'gps_disabled' ? 'border-red-500' : 'border-yellow-500'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${notif.type === 'gps_disabled' ? 'text-red-400' : 'text-yellow-400'}`} />
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{notif.message}</p>
                    <p className="text-slate-400 text-xs">{new Date(notif.created_at).toLocaleString()}</p>
                  </div>
                  {(notif.latitude || notif.last_known_lat) && (
                    <button
                      onClick={() => openInMaps(notif.latitude || notif.last_known_lat, notif.longitude || notif.last_known_lng)}
                      className="p-2 bg-primary/20 hover:bg-primary/40 rounded-lg transition-all"
                      title="Route to location"
                    >
                      <Navigation className="w-4 h-4 text-primary" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Geofences - Parent Only */}
          {user?.role === 'parent' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-secondary" />
                  <span>Safe Zones</span>
                </h2>
                <button
                  onClick={() => setShowAddGeofence(true)}
                  className="bg-secondary hover:bg-secondary/80 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1"
                  data-testid="add-geofence-btn"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Zone</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {geofences.map(fence => (
                  <div key={fence.geofence_id} className="glass-card rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-secondary" />
                        <span className="font-bold text-white text-sm">{fence.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteGeofence(fence.geofence_id)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">Radius: {fence.radius_feet}ft</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        onClick={() => {
                          setMapCenter({ lat: fence.latitude, lng: fence.longitude });
                          setShowMap(true);
                        }}
                        className="text-xs text-primary hover:underline flex items-center space-x-1"
                      >
                        <Map className="w-3 h-3" />
                        <span>Show on Map</span>
                      </button>
                      <button
                        onClick={() => openInMaps(fence.latitude, fence.longitude)}
                        className="text-xs text-secondary hover:underline flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Navigate</span>
                      </button>
                    </div>
                  </div>
                ))}
                {geofences.length === 0 && (
                  <p className="text-slate-500 text-sm col-span-2 text-center py-4">No safe zones set up yet</p>
                )}
              </div>
            </div>
          )}

          {/* Children Location - Parent Only */}
          {user?.role === 'parent' && children.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-white">Family Members</h2>
              <div className="flex space-x-2 overflow-x-auto pb-2">
                {children.map(child => (
                  <button
                    key={child.user_id}
                    onClick={() => { setSelectedChild(child); fetchChildCheckins(child.user_id); }}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-full transition-all flex-shrink-0 ${
                      selectedChild?.user_id === child.user_id
                        ? 'bg-primary text-white'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
                      {child.name?.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{child.name}</span>
                  </button>
                ))}
              </div>

              {selectedChild && checkins.length > 0 && (
                <div className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">{selectedChild.name}'s Recent Locations</h3>
                    <button
                      onClick={() => openInMaps(checkins[0].latitude, checkins[0].longitude)}
                      className="bg-primary hover:bg-primary/80 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Route to Last</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {checkins.slice(0, 5).map((checkin, i) => (
                      <div key={checkin.checkin_id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className={`w-4 h-4 ${i === 0 ? 'text-green-400' : 'text-slate-500'}`} />
                          <div>
                            <p className="text-white text-sm">{checkin.address || `${checkin.latitude.toFixed(4)}, ${checkin.longitude.toFixed(4)}`}</p>
                            <p className="text-slate-500 text-xs">{new Date(checkin.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {checkin.is_offline_update && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Offline</span>
                          )}
                          <button
                            onClick={() => {
                              setMapCenter({ lat: checkin.latitude, lng: checkin.longitude });
                              setShowMap(true);
                            }}
                            className="p-1 hover:bg-slate-800 rounded"
                          >
                            <Map className="w-3 h-3 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Child's own location */}
          {user?.role === 'child' && currentLocation && (
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span>Your Current Location</span>
              </h3>
              <p className="text-slate-400 text-sm">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </p>
              <p className="text-slate-500 text-xs mt-2">Your location is being shared with your parents</p>
            </div>
          )}
        </div>
      </main>

      {/* Add Geofence Modal */}
      {showAddGeofence && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Add Safe Zone</h2>
              <button onClick={() => setShowAddGeofence(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddGeofence} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Zone Name</label>
                <input
                  type="text"
                  placeholder="e.g., Home, School"
                  value={newGeofence.name}
                  onChange={(e) => setNewGeofence({...newGeofence, name: e.target.value})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Latitude</label>
                  <input
                    type="text"
                    placeholder="Click map or enter"
                    value={newGeofence.latitude}
                    onChange={(e) => setNewGeofence({...newGeofence, latitude: e.target.value})}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder:text-slate-600 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Longitude</label>
                  <input
                    type="text"
                    placeholder="Click map or enter"
                    value={newGeofence.longitude}
                    onChange={(e) => setNewGeofence({...newGeofence, longitude: e.target.value})}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder:text-slate-600 text-sm"
                    required
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={useCurrentLocation}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg transition-all"
              >
                Use My Current Location
              </button>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Alert Radius (feet)</label>
                <input
                  type="number"
                  value={newGeofence.radius_feet}
                  onChange={(e) => setNewGeofence({...newGeofence, radius_feet: parseInt(e.target.value)})}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm"
                  min="10"
                  max="1000"
                />
              </div>
              <button type="submit" className="w-full bg-secondary hover:bg-secondary/80 text-white font-bold py-2.5 rounded-full transition-all text-sm">
                Create Safe Zone
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
