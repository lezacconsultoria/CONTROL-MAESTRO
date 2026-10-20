import "server-only";
import { pbJson, pbTodos } from "./pb";
import type { Api } from "./linkedin-sync";

// Acceso a PocketBase con la sesión del usuario, en la forma que esperan los importadores.
export const apiPb: Api = {
  listar: (coleccion, filtro) => pbTodos(coleccion, filtro),
  crear: (coleccion, datos) => pbJson("POST", `collections/${coleccion}/records`, datos),
  actualizar: (coleccion, id, datos) => pbJson("PATCH", `collections/${coleccion}/records/${id}`, datos),
  borrar: (coleccion, id) => pbJson("DELETE", `collections/${coleccion}/records/${id}`),
};
