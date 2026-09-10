# PDF Maestro para Mac

## Instalación

- Apple Silicon (M1, M2, M3, M4 y posteriores): `PDF-Maestro-Mac-arm64.dmg`.
- Intel: `PDF-Maestro-Mac-x64.dmg`.

Abre el DMG y arrastra PDF Maestro a Aplicaciones.

Los instaladores tienen firma local ad hoc. No cuentan con un certificado
Developer ID de Apple ni notarización; macOS puede pedir autorización para abrirlos.
No se ha modificado la protección de seguridad del Mac.

El editor se ejecuta en el equipo. El primer uso de OCR e IA requiere Internet
para descargar los modelos. Los documentos se procesan localmente.

## Generar los instaladores

En macOS con Node.js 24:

```sh
npm ci
npm run build
npx electron-builder --mac dmg --arm64 --x64 --publish never
```

Los archivos se generan en `release/`. GitHub Actions también genera ambos DMG
al cambiar el código en `main` o al ejecutar manualmente «Crear aplicación para Mac».
Las versiones de Electron y electron-builder están fijadas en `package-lock.json`.

Para distribuir una versión notarizada será necesario un certificado Developer ID
y las credenciales de notarización de una cuenta Apple Developer.
