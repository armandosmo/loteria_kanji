import { useEffect, useRef, useState } from 'react';

const MAX_RETRIES = 5;

export default function useGameSocket({ partidaId, jugadorId, onMessage }) {
  const [conectado, setConectado] = useState(false);
  const wsRef = useRef(null);
  const retriesRef = useRef(0);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!partidaId || !jugadorId) return;

    let unmounted = false;
    let reconnectTimer;

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(
        `${protocol}://${location.host}/ws/${partidaId}/${jugadorId}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        const wasReconnect = retriesRef.current > 0;
        setConectado(true);
        retriesRef.current = 0;
        if (wasReconnect) {
          onMessageRef.current?.({ type: 'reconnected' });
        }
      };

      ws.onmessage = (e) => {
        if (unmounted) return;
        try {
          const { tipo, ...payload } = JSON.parse(e.data);
          if (tipo === 'ping') return;
          onMessageRef.current?.({ type: tipo, ...payload });
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConectado(false);
        if (retriesRef.current < MAX_RETRIES) {
          const delay = Math.min(500 * Math.pow(2, retriesRef.current), 4000);
          retriesRef.current++;
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [partidaId, jugadorId]);

  return { conectado };
}
