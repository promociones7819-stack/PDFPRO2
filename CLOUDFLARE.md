# Publicar PDF Maestro (PDFPRO2)

Repositorio: https://github.com/promociones7819-stack/PDFPRO2

## Aplicación publicada

URL: https://pdfpro2.promociones7819.workers.dev

Publicada el 10 de septiembre de 2026 mediante Wrangler, con el nombre `pdfpro2`.
La aplicación está conectada a `promociones7819-stack/PDFPRO2`. Los cambios en
`main` se compilan con `npm run build` y se publican con `npx wrangler deploy`.
Se utiliza `package-lock.json` para instalar versiones reproducibles con npm.
Las ramas distintas de producción generan versiones de vista previa.

## Configurar despliegues automáticos con GitHub

1. En Cloudflare, abre Workers & Pages y crea una aplicación conectada a GitHub.
2. Selecciona `promociones7819-stack/PDFPRO2` y la rama `main`.
3. Usa el nombre `pdfpro2`, coincidente con `wrangler.jsonc`.
4. Directorio raíz: la raíz del repositorio.
5. Comando de instalación: `npm ci`.
6. Comando de compilación: `npm run build`.
7. Comando de despliegue: `npx wrangler deploy`.
8. Usa Node.js 24 (el archivo `.nvmrc` también indica esta versión).

La compilación genera `dist/`. Wrangler publica esos archivos y utiliza
`index.html` como entrada de la aplicación SPA. No requiere servidor SSR.
Para actualizar la aplicación manualmente, ejecuta `npm run deploy:cloudflare`.

## Comprobación local

```sh
npm ci
npm test
npm run build
```

## Publicar desde el ordenador

```sh
npx wrangler login
npm run deploy:cloudflare
```

Documentación oficial:
https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
https://developers.cloudflare.com/workers/static-assets/get-started/
