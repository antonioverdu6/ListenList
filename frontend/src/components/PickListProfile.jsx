import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import API_URL from '../config/api';
const API_URL_SONGS = `${API_URL}/musica/buscar_api/`;
const API_URL_ALBUMS = `${API_URL}/musica/api/albums_buscar/`;
const API_URL_ARTISTS = `${API_URL}/musica/api/artistas_buscar/`;

const endpointMap = {
  songs: (qq) => `${API_URL_SONGS}?q=${encodeURIComponent(qq)}`,
  albums: (qq) => `${API_URL_ALBUMS}?q=${encodeURIComponent(qq)}`,
  artists: (qq) => `${API_URL_ARTISTS}?q=${encodeURIComponent(qq)}`,
};

// PickListProfile
// - 3 clickable slots
// - clicking a slot opens an accessible popover with search + tabs + results
// - selecting an item fills the slot and closes the popover
// Results are fetched from the Django API so the component can be embedded elsewhere.

export default function PickListProfile({ initial = [null, null, null] }) {
  const [pickedItems, setPickedItems] = useState(() => initial.slice(0, 3));
  const [openSlot, setOpenSlot] = useState(null); // index of slot currently editing
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('songs');
  const popoverRef = useRef(null);

  const [fetchVersion, setFetchVersion] = useState(0);

  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const allByFilter = useMemo(() => ({ songs, albums, artists }), [songs, albums, artists]);

  const filteredResults = useMemo(() => {
    const list = allByFilter[activeFilter] || [];
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(item => (item.name || '').toLowerCase().includes(q) || (item.artist || '').toLowerCase().includes(q));
  }, [activeFilter, searchTerm, allByFilter]);

  useEffect(() => {
    if (openSlot === null) return undefined;
    const controller = new AbortController();
    let isMounted = true;
    const q = (searchTerm || '').trim();
    const qToUse = q || 'a';
    const filterSnapshot = activeFilter;
    const url = (endpointMap[filterSnapshot] || endpointMap.songs)(qToUse);

    async function fetchResults() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        return list.filter(item => (item.name || '').toLowerCase().includes(q) || (item.artist || '').toLowerCase().includes(q));
        const data = await res.json();
        if (!isMounted) return;
        const rawItems = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        const norm = rawItems.map((it) => {
          if (!it) return null;
          if (filterSnapshot === 'songs') {
            return {
              id: it.spotify_id || it.id || it.spotifyId,
              type: 'song',
              name: it.nombre || it.name || it.titulo,
              artist:
                it.artista ||
                (it.album && it.album.artista) ||
                it.artist ||
                (it.album && it.album.artista && (it.album.artista.nombre || it.album.artista.name)) ||
                null,
              imageUrl:
                it.imagen ||
                it.imagen_url ||
                it.image_url ||
                it.imageUrl ||
                (it.album && (it.album.imagen_url || it.album.image_url || it.album.imageUrl)) ||
                (Array.isArray(it.images) && it.images[0] && it.images[0].url) ||
                (it.album && Array.isArray(it.album.images) && it.album.images[0] && it.album.images[0].url) ||
                null,
            };
          }
          if (filterSnapshot === 'albums') {
            return {
              id: it.spotify_id || it.id,
              type: 'album',
              name: it.titulo || it.nombre || it.name,
              artist: (it.artista && (it.artista.nombre || it.artista.name)) || it.artist || null,
              imageUrl:
                it.imagen ||
                it.imagen_url ||
                it.image_url ||
                it.imageUrl ||
                (Array.isArray(it.images) && it.images[0] && it.images[0].url) ||
                null,
            };
          }
          if (filterSnapshot === 'artists') {
            return {
              id: it.id,
              type: 'artist',
              name: it.nombre || it.name,
              artist: null,
              imageUrl:
                it.imagen ||
                it.imagen_url ||
                it.image_url ||
                it.imageUrl ||
                (Array.isArray(it.images) && it.images[0] && it.images[0].url) ||
                null,
            };
          }
          return null;
        }).filter(Boolean);

        if (!isMounted) return;
        if (filterSnapshot === 'songs') setSongs(norm);
        else if (filterSnapshot === 'albums') setAlbums(norm);
        else if (filterSnapshot === 'artists') setArtists(norm);
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (!isMounted) return;
        setError(err.message || 'Error cargando resultados');
        if (filterSnapshot === 'songs') setSongs([]);
        else if (filterSnapshot === 'albums') setAlbums([]);
        else if (filterSnapshot === 'artists') setArtists([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchResults();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [openSlot, searchTerm, activeFilter, fetchVersion]);

  const retryFetch = () => setFetchVersion((prev) => prev + 1);

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
                {loading ? (
                  <div className="text-gray-400 p-4">Cargando resultados...</div>
                ) : error ? (
                  <div className="text-red-400 p-4 space-y-2">
                    <div>Error cargando resultados: {error}</div>
                    <button
                      type="button"
                      className="px-3 py-1 rounded bg-green-600 text-white"
                      onClick={retryFetch}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="text-gray-400 p-4">
                    {(searchTerm || '').trim() ? 'No hay resultados.' : 'Escribe algo para buscar canciones...'}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {filteredResults.map(r => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800"
                          onClick={() => selectItem({ id: r.id, name: r.name, artist: r.artist, imageUrl: r.imageUrl, type: r.type })}
                        >
                          <img
                            src={r.imageUrl || r.image_url || '/default-cover.png'}
                            alt="thumb"
                            className="w-12 h-12 rounded object-cover"
                          />
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
