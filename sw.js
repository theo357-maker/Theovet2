// Version de l'application - À MODIFIER à chaque mise à jour
const APP_VERSION = '1.1.0';
const CACHE_NAME = `theovet-cache-v${APP_VERSION}`;

// Fichiers à mettre en cache pour le fonctionnement offline
const STATIC_CACHE_URLS = [
  '/',
  './index.html',
  './manifest.json',
  'icon-72x72.png',
  'icon-96x96.png',
  'icon-128x128.png',
  'icon-144x144.png',
  'icon-152x152.png',
  'icon-192x192.png',
  'icon-384x384.png',
  'icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log(`🔄 Service Worker installé - Version ${APP_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Mise en cache des ressources statiques');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Toutes les ressources sont en cache');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Erreur lors de l\'installation du cache:', error);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activé');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Supprimer les anciens caches
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Suppression de l'ancien cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Nettoyage des anciens caches terminé');
      // Prendre le contrôle de toutes les pages
      return self.clients.claim();
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET et les requêtes Firebase
  if (event.request.method !== 'GET' || 
      event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Retourner la réponse en cache si elle existe
        if (cachedResponse) {
          return cachedResponse;
        }

        // Sinon, faire la requête réseau
        return fetch(event.request)
          .then((response) => {
            // Vérifier si la réponse est valide
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cloner la réponse pour la mettre en cache
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // En cas d'erreur réseau, on pourrait retourner une page offline personnalisée
            // Pour l'instant, on laisse l'erreur se propager
            console.log('🌐 Mode hors ligne - Requête échouée:', event.request.url);
          });
      })
  );
});

// Gestion des messages depuis l'application
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage(APP_VERSION);
  }
});

// Vérification des mises à jour en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Synchronisation en arrière-plan');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Ici vous pouvez implémenter la synchronisation des données
  // avec Firebase lorsque la connexion est rétablie
  console.log('🔄 Synchronisation des données...');
}

// Gestion des notifications push
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle notification TheoVêt',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Ouvrir'
      },
      {
        action: 'close',
        title: 'Fermer'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TheoVêt', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});