# Game Art Assets

Place production pixel-art assets here for Phaser runtime loading.

Recommended structure:

- `scene/` for background, tileset, foreground layers
- `pets/` for pet spritesheets and animation json
- `fx/` for particles and action VFX
- `ui/` for HUD/button/icon textures

See `doc/像素美术资源规格与交付清单.md` for required files and quality gates.

Current runtime skin pack (cycle 5, PNG):

- `ui/`: `btn_action_*.png`, `dock_frame.png`, `hud_panel.png`, `toast_panel.png`, `modal_panel.png`, `auth_panel_bg.png`, `icon_*.png`
- `ui/` (HUD + auth): `hud_bar_bg.png`, `hud_bar_fill_{satiety,health,mood,event}.png`, `stat_icon_{hunger,health,mood}.png`, `tab_auth_{inactive,active}.png`, `btn_auth_{primary,secondary}.png`
- `scene/garden_bg_playfield.png`: Phaser + `#game-mount` backdrop (clean garden, no HUD in art)
- `scene/garden_foreground.png`: grass foreground strip
- `scene/ui_garden_main_multi_pet.png`: optional fallback (design reference) if playfield missing
- `pets/cat/cat_idle.png`: default cat sprite
- `fx/{heart_burst,spark_pop,food_pop}.png`: interaction VFX
