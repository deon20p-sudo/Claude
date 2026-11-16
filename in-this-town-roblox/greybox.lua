-- Stage 2 grey-box for "In this town, everyone has a number above their head".
-- Paste into the Roblox Studio command bar (View -> Command Bar) on an empty baseplate,
-- or have Claude run it through the Studio MCP connection. Safe to run again: it
-- replaces its own folder and touches nothing else.
--
-- Layout is the code-rendered film's town at 3 studs per unit, centred on the origin.
-- +Z is the south street (Sam's house, the park), -Z is the north street (bakery).

local S = 3
local GREY = Color3.fromRGB(150, 150, 150)
local DARK = Color3.fromRGB(105, 105, 105)
local LIGHT = Color3.fromRGB(190, 190, 190)

local old = workspace:FindFirstChild("ITT_Greybox")
if old then old:Destroy() end
local root = Instance.new("Folder")
root.Name = "ITT_Greybox"
root.Parent = workspace

local function folder(name)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = root
	return f
end

-- box given in film units: size (w, h, d), centre x/z, base height y0, optional yaw in radians
local function box(parent, name, w, h, d, x, z, y0, color, yaw)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Material = Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Color = color or GREY
	p.Size = Vector3.new(w * S, h * S, d * S)
	p.CFrame = CFrame.new(x * S, ((y0 or 0) + h / 2) * S, z * S) * CFrame.Angles(0, yaw or 0, 0)
	p.Parent = parent
	return p
end

local function label(part, text)
	local g = Instance.new("BillboardGui")
	g.Name = "Label"
	g.Size = UDim2.new(0, 220, 0, 40)
	g.StudsOffset = Vector3.new(0, part.Size.Y / 2 + 2.5, 0)
	g.AlwaysOnTop = true
	g.Parent = part
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, 0, 1, 0)
	t.BackgroundTransparency = 1
	t.Text = text
	t.TextScaled = true
	t.Font = Enum.Font.GothamBold
	t.TextColor3 = Color3.new(1, 1, 1)
	t.TextStrokeTransparency = 0
	t.Parent = g
end

-- ground and streets ---------------------------------------------------------
local streets = folder("Streets")
box(streets, "Ground", 200, 0.2, 200, 0, 8, -0.2, DARK)
box(streets, "Square", 26, 0.05, 26, 0, 0, 0, LIGHT)
box(streets, "SouthStreet", 6, 0.05, 55, 0, 40.5, 0, LIGHT)
box(streets, "NorthStreet", 6, 0.05, 24, 0, -25, 0, LIGHT)
box(streets, "EastStreet", 49, 0.05, 6, 37.5, 0, 0, LIGHT)
box(streets, "WestStreet", 49, 0.05, 6, -37.5, 0, 0, LIGHT)

-- bell tower -----------------------------------------------------------------
local tower = folder("BellTower")
box(tower, "Shaft", 6, 19, 6, 0, 0, 0)
box(tower, "Door", 1.7, 2.7, 0.3, 0, 3.05, 0.9, DARK)
box(tower, "BelfryFloor", 6.8, 0.3, 6.8, 0, 0, 19)
for _, sx in ipairs({ -1, 1 }) do
	for _, sz in ipairs({ -1, 1 }) do
		box(tower, "BelfryPillar", 0.7, 4.3, 0.7, sx * 2.65, sz * 2.65, 19.3)
	end
end
box(tower, "BelfryRailSouth", 4.6, 0.4, 0.35, 0, 2.8, 19.3)
box(tower, "BelfryRailNorth", 4.6, 0.4, 0.35, 0, -2.8, 19.3)
box(tower, "BelfryRailEast", 0.35, 0.4, 4.6, 2.8, 0, 19.3)
box(tower, "BelfryRailWest", 0.35, 0.4, 4.6, -2.8, 0, 19.3)
box(tower, "BelfryCap", 6.8, 0.8, 6.8, 0, 0, 23.6)
box(tower, "Roof", 5, 6, 5, 0, 0, 24.4)
box(tower, "Bell", 1.6, 1.6, 1.6, 0, 0, 21.6, DARK)
label(box(tower, "LedgeMarker", 1.2, 0.2, 0.6, 0.9, 3.6, 18.9, DARK), "LEDGE (Ivy hangs here)")

-- houses ---------------------------------------------------------------------
local houses = folder("Houses")
local n = 0
local function house(x, z, yaw, w, h, d)
	n = n + 1
	return box(houses, "House" .. n, w or 6.2, h or (n % 3 == 0 and 9 or 6), d or 6.2, x, z, 0, GREY, yaw)
end
for _, z in ipairs({ 17, 25, 33, 41, 49, 57, 65 }) do house(-8.6, z, 0) end
for _, z in ipairs({ 52.5, 60.5 }) do house(8.6, z, 0) end
for _, x in ipairs({ 17, 25, 33, 41, 49, 57 }) do
	house(x, -8.6, 0)
	house(-x, -8.6, 0)
	house(-x, 8.6, 0)
	if x > 26 then house(x, 8.6, 0) end
end
for _, z in ipairs({ -17, -25 }) do
	house(-8.6, z, 0)
	house(8.6, z, 0)
end
house(-8.6, -33, 0)
-- back rows, so no shot looks out at empty ground
for gx = -62, 62, 9 do
	for gz = -44, 67, 9 do
		local nearStreet = math.abs(gx) < 15.5 or math.abs(gz) < 15.5
		local park = gx > 3 and gx < 27 and gz > 10 and gz < 50
		if not nearStreet and not park then house(gx, gz, 0) end
	end
end

-- named places ---------------------------------------------------------------
local places = folder("Places")
label(box(places, "SamsHouse", 7, 7.8, 7, 8.5, 44, 0, LIGHT), "SAM'S HOUSE (bedroom upstairs)")
label(box(places, "Bakery", 6.6, 3.4, 7, 8.6, -30.5, 0, LIGHT), "BAKERY (Sam leaves the basket)")
label(box(places, "NoticeBoard", 3, 2.6, 0.2, -6.5, 6.5, 0, LIGHT, 0.585), "TOP FRIENDS BOARD")
label(box(places, "ParkPond", 8.4, 0.1, 8.4, 17, 26, 0, DARK), "PARK POND")
label(box(places, "BenchA", 1.8, 0.5, 0.5, 11.5, 22, 0, LIGHT, 0.4), "BENCH (best seats)")
label(box(places, "BenchB", 1.8, 0.5, 0.5, 12, 31, 0, LIGHT, -0.3), "BENCH (ending)")
for i, t in ipairs({ { 23, 15 }, { 24, 34 }, { 22, 44 }, { 14, 15.5 } }) do
	box(places, "Tree" .. i, 1, 5, 1, t[1], t[2], 0, DARK)
end

-- where each character stands ------------------------------------------------
local marks = folder("CharacterMarkers")
local function mark(name, text, x, z, y0)
	label(box(marks, name, 0.7, 1.7, 0.4, x, z, y0 or 0, DARK), text)
end
mark("Sam_Intro", "SAM 0 (intro)", 0.8, 30)
mark("Sam_Hello", "SAM 0 (says hello)", 4.3, 7)
mark("Passerby", "PASSER-BY 44", 2.4, 8.9)
mark("FriendA", "FRIEND 12", 3.0, 9.5)
mark("FriendB", "FRIEND 30", 4.4, 9.5)
mark("Mayor", "MAYOR 412", 0.5, 9)
mark("Ivy_Square", "IVY 87 + her crowd", -4.6, 9.2)
mark("LonelyEater", "LOW NUMBER 2 (eats alone)", 12, 31)
mark("Sam_Bakery", "SAM (night, basket)", 4.15, -30.5)
mark("Sam_Bed", "SAM (bed, upstairs)", 7.75, 41.45, 8)
mark("Crowd_TowerBase", "CROWD OF 19 (storm)", 0, 9.5)
mark("Sam_Run", "SAM runs to tower", 0, 13)
mark("Ivy_Hanging", "IVY 87 -> 0", 0.9, 4.2, 17.2)
mark("Sam_Belfry", "SAM 0 (belfry)", 0.9, 2.3, 19.3)
mark("Sam_Bench", "SAM 0 -> -1 (ending)", 11.4, 30.6)
mark("Ivy_Bench", "IVY 1 (ending)", 12.6, 31.3)

print("ITT_Greybox built: " .. #root:GetDescendants() .. " instances, " .. n .. " houses")
