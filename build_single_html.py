import os
import re
import subprocess
import sys
import webbrowser

def main():
    print("=== Étape 1 : Compilation de l'application React SPA ===")
    
    # Executer le build Vite
    try:
        # Sur Windows, shell=True est requis pour lancer npx dans powershell/cmd
        build_env = os.environ.copy()
        build_env["ZGR_AUTONOMOUS_BUILD"] = "1"
        build_env["VITE_ZGR_API_URL"] = (
            "https://zgr-cv-storage-api.zgrcv-wizi.workers.dev/api/clients"
        )
        result = subprocess.run(
            ["npx", "vite", "build", "--config", "vite.spa.config.ts"],
            shell=True,
            check=True,
            capture_output=True,
            text=True,
            env=build_env,
        )
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print("Erreur lors de la compilation Vite :", file=sys.stderr)
        print(e.stderr, file=sys.stderr)
        sys.exit(1)
        
    print("=== Étape 2 : Fusion des ressources dans un seul fichier HTML ===")
    
    dist_dir = "dist-spa"
    index_html_path = os.path.join(dist_dir, "index.html")
    
    if not os.path.exists(index_html_path):
        print(f"Erreur : Le fichier {index_html_path} n'existe pas.", file=sys.stderr)
        sys.exit(1)
        
    with open(index_html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    # Fonction pour charger le contenu d'un fichier asset
    def get_asset_content(asset_path):
        # Enlever le slash initial s'il existe
        if asset_path.startswith("/"):
            asset_path = asset_path[1:]
        # S'assurer que le chemin est relatif au dossier de build
        full_path = os.path.join(dist_dir, asset_path)
        if not os.path.exists(full_path):
            # Si pas trouvé, essayer de chercher dans le dossier assets/
            basename = os.path.basename(asset_path)
            full_path = os.path.join(dist_dir, "assets", basename)
            
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as asset_file:
                return asset_file.read()
        else:
            print(f"Avertissement : Fichier asset non trouvé : {asset_path}")
            return ""

    # 1. Inline CSS stylesheets
    # Recherche les balises <link rel="stylesheet" ... href="..."> ou similaire
    css_pattern = re.compile(r'<link\s+[^>]*href="([^"]+\.css)"[^>]*>')
    
    def replace_css(match):
        css_path = match.group(1)
        print(f"Inlining CSS : {css_path}")
        css_content = get_asset_content(css_path)
        return f"<style>{css_content}</style>"
        
    html_content = css_pattern.sub(replace_css, html_content)

    # 2. Inline JS scripts
    # Recherche les balises <script ... src="...">
    js_pattern = re.compile(r'<script\s+[^>]*src="([^"]+\.js)"[^>]*>\s*</script>')
    
    def replace_js(match):
        js_path = match.group(1)
        print(f"Inlining JS : {js_path}")
        js_content = get_asset_content(js_path)
        # Échapper les séquences </script> à l'intérieur du JS si nécessaire pour éviter la fermeture anticipée de la balise
        js_content_safe = js_content.replace("</script>", "<\\/script>")
        return f'<script type="module">{js_content_safe}</script>'
        
    html_content = js_pattern.sub(replace_js, html_content)
    
    # 3. Retirer les balises modulepreload de Vite inutiles
    html_content = re.sub(r'<link\s+[^>]*rel="modulepreload"[^>]*>', "", html_content)
    
    output_html_path = "ZGR_CV_Autonome.html"
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print(f"\n=== Succès ! Fichier HTML unique autonome créé : {os.path.abspath(output_html_path)} ===")
    
    # L'ouverture est volontairement optionnelle pour que les builds CI restent silencieux.
    if "--open" in sys.argv:
        print("Ouverture du fichier dans le navigateur...")
        webbrowser.open(f"file://{os.path.abspath(output_html_path)}")

if __name__ == "__main__":
    main()
