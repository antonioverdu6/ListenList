import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

// PickListProfile
// - 3 clickable slots
// - clicking a slot opens an accessible popover with search + tabs + results
// - selecting an item fills the slot and closes the popover
// - mock data provided for songs, albums, artists
// Note: uses Tailwind-like class names for modern styling; if Tailwind is not configured
// they will act as normal class names (you can adapt to your CSS setup).

export default function PickListProfile({ initial = [null, null, null] }) {
  const [pickedItems, setPickedItems] = useState(() => initial.slice(0, 3));
  const [openSlot, setOpenSlot] = useState(null); // index of slot currently editing
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('songs');
  const popoverRef = useRef(null);

  // Mock data
  const songs = useMemo(() => [
    { id: 's1', name: 'Blinding Lights', artist: 'The Weeknd', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273e4a1a9d1f6f0a7d7b6c4b5e2', type: 'song' },
    { id: 's2', name: 'Save Your Tears', artist: 'The Weeknd', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273b1b2a3c4d5e6f7a8b9c0d1e2', type: 'song' },
    { id: 's3', name: 'As It Was', artist: 'Harry Styles', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273c3d4e5f6a7b8c9d0e1f2a3b4', type: 'song' },
    { id: 's4', name: 'Die For You', artist: 'The Weeknd', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273d4e5f67890abcdef12345678', type: 'song' },
  ], []);

  const albums = useMemo(() => [
    { id: 'a1', name: 'After Hours', artist: 'The Weeknd', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273aaaabbbbccccddddeeefff111', type: 'album' },
    { id: 'a2', name: 'Fine Line', artist: 'Harry Styles', imageUrl: 'https://i.scdn.co/image/ab67616d0000b273111222333444555666777888', type: 'album' },
  ], []);

  const artists = useMemo(() => [
    { id: 'ar1', name: 'The Weeknd', artist: '', imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb1234567890abcdef12345678', type: 'artist' },
    { id: 'ar2', name: 'Harry Styles', artist: '', imageUrl: 'https://i.scdn.co/image/ab6761610000e5ebabcdef0123456789abcdef01', type: 'artist' },
  ], []);

  const allByFilter = useMemo(() => ({ songs, albums, artists }), [songs, albums, artists]);

  const filteredResults = useMemo(() => {
    const list = allByFilter[activeFilter] || [];
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(item => (item.name || '').toLowerCase().includes(q) || (item.artist || '').toLowerCase().includes(q));
  }, [activeFilter, searchTerm, allByFilter]);

  // Close popover on ESC or click outside
  useEffect(() => {
    if (openSlot === null) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpenSlot(null);
    }
    function onClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpenSlot(null);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [openSlot]);

  function openForSlot(i) {
    setOpenSlot(i);
    setActiveFilter('songs');
    setSearchTerm('');
  }

  function selectItem(item) {
    if (openSlot === null) return;
    setPickedItems(prev => {
      const copy = [...prev];
      copy[openSlot] = item;
      return copy;
    });
    setOpenSlot(null);
  }

  function clearSlot(i) {
    setPickedItems(prev => {
      const copy = [...prev];
      copy[i] = null;
      return copy;
    });
  }

  return (
    <div className="picklist-profile max-w-xl mx-auto">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => {
          const item = pickedItems[i];
          return (
            <div key={i} className="slot">
              <button
                type="button"
                onClick={() => openForSlot(i)}
                className={`w-full h-36 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-3 text-center focus:outline-none focus:ring-2 focus:ring-green-400 ${item ? 'border-transparent bg-gradient-to-br from-gray-800 to-gray-700' : 'hover:border-green-400'}`}
                aria-haspopup="dialog"
                aria-expanded={openSlot === i}
              >
                {item ? (
                  <div className="w-full h-full flex items-center gap-3">
                    <img src={item.imageUrl} alt="thumb" className="w-16 h-16 object-cover rounded" />
                    <div className="text-left truncate">
                      <div className="font-semibold text-white">{item.name}</div>
                      {item.artist && <div className="text-sm text-gray-300">{item.artist}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-300">
                    <div className="text-3xl font-bold text-green-400">+</div>
                    <div className="mt-2 text-sm">Pin tu canción favorita</div>
                  </div>
                )}
              </button>
              {item && (
                <div className="mt-2 flex justify-between items-center">
                  <button type="button" className="text-sm text-gray-300" onClick={() => openForSlot(i)}>Reemplazar</button>
                  <button type="button" className="text-sm text-red-400" onClick={() => clearSlot(i)}>Quitar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Popover overlay + dialog */}
      {openSlot !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div className="fixed inset-0 bg-black/50" aria-hidden />
          <div ref={popoverRef} role="dialog" aria-modal="true" className="relative z-60 w-full max-w-2xl bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg shadow-xl overflow-hidden">
            <div className="p-4">
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-md p-2 bg-gray-800 border border-gray-700 text-white"
                  placeholder={`Buscar en ${activeFilter}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                <button className="px-3 rounded-md bg-green-500 text-white" onClick={() => setSearchTerm('')}>Limpiar</button>
              </div>

              <div className="mt-3 flex gap-2">
                <button className={`px-3 py-1 rounded ${activeFilter === 'songs' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => setActiveFilter('songs')}>Canciones</button>
                <button className={`px-3 py-1 rounded ${activeFilter === 'albums' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => setActiveFilter('albums')}>Álbumes</button>
                <button className={`px-3 py-1 rounded ${activeFilter === 'artists' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`} onClick={() => setActiveFilter('artists')}>Artistas</button>
              </div>

              <div className="mt-4 max-h-64 overflow-auto">
                {filteredResults.length === 0 ? (
                  <div className="text-gray-400 p-4">No hay resultados.</div>
                ) : (
                  <ul className="space-y-2">
                    {filteredResults.map(r => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800"
                          onClick={() => selectItem({ id: r.id, name: r.name, artist: r.artist, imageUrl: r.imageUrl, type: r.type })}
                        >
                          <img src={r.imageUrl} alt="thumb" className="w-12 h-12 rounded object-cover" />
                          <div className="text-left">
                            <div className="font-semibold text-white">{r.name}</div>
                            {r.artist && <div className="text-sm text-gray-300">{r.artist}</div>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button type="button" className="px-4 py-2 rounded bg-gray-700 text-gray-200" onClick={() => setOpenSlot(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

PickListProfile.propTypes = {
  initial: PropTypes.array,
};

PickListProfile.defaultProps = { initial: [null, null, null] };
