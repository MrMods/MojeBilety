import { onRequestDelete as __api_admin_event__id__js_onRequestDelete } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\event\\[id].js"
import { onRequestPut as __api_admin_event__id__js_onRequestPut } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\event\\[id].js"
import { onRequestGet as __api_admin_seats__eventId__js_onRequestGet } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\seats\\[eventId].js"
import { onRequestPost as __api_admin_seats__eventId__js_onRequestPost } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\seats\\[eventId].js"
import { onRequestGet as __api_admin_events_js_onRequestGet } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\events.js"
import { onRequestPost as __api_admin_events_js_onRequestPost } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\events.js"
import { onRequestPost as __api_admin_login_js_onRequestPost } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\login.js"
import { onRequestGet as __api_admin_reservations_js_onRequestGet } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\reservations.js"
import { onRequestPost as __api_admin_reservations_js_onRequestPost } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\admin\\reservations.js"
import { onRequestGet as __api_event__id__js_onRequestGet } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\event\\[id].js"
import { onRequestGet as __api_reservation__code__js_onRequestGet } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\reservation\\[code].js"
import { onRequestGet as __api_events_js_onRequestGet } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\events.js"
import { onRequestPost as __api_reserve_js_onRequestPost } from "C:\\Users\\Krystian\\Desktop\\Mojebilety\\functions\\api\\reserve.js"

export const routes = [
    {
      routePath: "/api/admin/event/:id",
      mountPath: "/api/admin/event",
      method: "DELETE",
      middlewares: [],
      modules: [__api_admin_event__id__js_onRequestDelete],
    },
  {
      routePath: "/api/admin/event/:id",
      mountPath: "/api/admin/event",
      method: "PUT",
      middlewares: [],
      modules: [__api_admin_event__id__js_onRequestPut],
    },
  {
      routePath: "/api/admin/seats/:eventId",
      mountPath: "/api/admin/seats",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_seats__eventId__js_onRequestGet],
    },
  {
      routePath: "/api/admin/seats/:eventId",
      mountPath: "/api/admin/seats",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_seats__eventId__js_onRequestPost],
    },
  {
      routePath: "/api/admin/events",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_events_js_onRequestGet],
    },
  {
      routePath: "/api/admin/events",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_events_js_onRequestPost],
    },
  {
      routePath: "/api/admin/login",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_login_js_onRequestPost],
    },
  {
      routePath: "/api/admin/reservations",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_reservations_js_onRequestGet],
    },
  {
      routePath: "/api/admin/reservations",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_reservations_js_onRequestPost],
    },
  {
      routePath: "/api/event/:id",
      mountPath: "/api/event",
      method: "GET",
      middlewares: [],
      modules: [__api_event__id__js_onRequestGet],
    },
  {
      routePath: "/api/reservation/:code",
      mountPath: "/api/reservation",
      method: "GET",
      middlewares: [],
      modules: [__api_reservation__code__js_onRequestGet],
    },
  {
      routePath: "/api/events",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_events_js_onRequestGet],
    },
  {
      routePath: "/api/reserve",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_reserve_js_onRequestPost],
    },
  ]