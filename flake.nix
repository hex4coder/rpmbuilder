{
  description = "Generator RPM - Perencanaan Pembelajaran Mendalam";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        # Lingkungan Pengembangan: jalankan `nix develop`
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            nodejs_22
            nodePackages.npm
            nodePackages.typescript-language-server
            # Tambahkan tool lain jika diperlukan seperti tailwindcss-language-server
          ];

          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
            echo "🚀 Generator RPM Development Environment"
            echo "Node.js version: $(node --version)"
            echo "NPM version: $(npm --version)"
            echo "Gunakan 'npm run dev' untuk memulai server pengembangan."
          '';
        };

        # Paket Build: jalankan `nix build`
        # Catatan: npmDepsHash perlu diperbarui jika package-lock.json berubah
        packages.default = pkgs.buildNpmPackage {
          pname = "generator-rpm";
          version = "0.0.0";
          src = ./.;

          npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; # Placeholder

          # Langkah build Vite
          installPhase = ''
            mkdir -p $out
            cp -r dist/* $out/
          '';

          meta = {
            description = "Sistem Cerdas Penyusun Administrasi Guru Profesional Berbasis AI";
            homepage = "https://github.com/hex4coder/rpmbuilder";
          };
        };
      });
}
