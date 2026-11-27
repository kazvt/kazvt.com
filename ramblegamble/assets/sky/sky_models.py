"""Additional authored retro silhouettes; component meshes are also collision input."""
import math
CASTS=(
 ('chair','book','orb','boat','card1','cat','car','desk','die','text','orb','book2','chair2','card2','cat2','car2','table'),
 ('telephone','television','orb','cassette','arcade','lamp','scooter','plane','submarine','text','orb','teapot','umbrella','cart','guitar','armchair','train'),
)
RADII=(60,51,73,59,50,49,55,67,39,95,64,43,48,48,45,50,49)

def new_models(box,ell,cyl,cone,P):
 # Each list comprises actual separate mesh pieces, not a recolored bounding box.
 lil,yel,cyan,red,orange,pink,black=P; metal='#9996ad'; dark='#433650'; cream='#f4e5d0'; glass='#657c91'
 def b(s,p,c):return box(s,p,c)
 def e(s,p,c):return ell(s,p,c)
 def c(r,h,p,col,axis='y'):return cyl(r,h,p,col,axis)
 models={}
 models['telephone']=[b((1.5,.36,1.08),(0,-.23,0),pink),c(.40,.08,(0,-.006,.12),cream),c(.26,.085,(0,.025,.12),dark),b((1.36,.22,.24),(0,.29,-.35),pink)]+[e((.27,.23,.34),(x,.24,-.35),pink) for x in (-.61,.61)]+[c(.046,.02,(.32*math.cos(i*.628),.045,.12+.32*math.sin(i*.628)),dark) for i in range(10)]
 models['television']=[b((1.56,1.12,.80),(0,0,0),lil),b((1.18,.81,.12),(-.10,.03,.44),dark),b((1.06,.70,.075),(-.10,.03,.53),glass),c(.075,.11,(.62,.14,.45),cream,'z'),c(.075,.11,(.62,-.08,.45),cream,'z'),b((.89,.12,.55),(0,-.60,0),dark),b((.035,.58,.035),(-.19,.79,0),metal),b((.035,.75,.035),(.19,.87,0),metal)]
 models['cassette']=[b((1.65,.18,1.03),(0,0,0),cyan),b((1.42,.045,.57),(0,.11,.02),cream),b((.92,.05,.33),(0,.14,.02),dark),b((.52,.05,.14),(0,.17,.02),glass)]+[c(.13,.065,(x,.17,.02),cream) for x in (-.32,.32)]+[c(.057,.07,(x,.20,.02),dark) for x in (-.32,.32)]
 models['arcade']=[b((.95,1.57,.66),(0,-.13,0),lil),b((.95,.35,.81),(0,.76,.05),pink),b((.74,.59,.07),(0,.31,.37),dark),b((.63,.46,.04),(0,.31,.42),glass),b((1.01,.16,.52),(0,-.14,.48),cyan),c(.045,.18,(-.25,.02,.57),metal),e((.09,.09,.09),(-.25,.15,.57),red),c(.06,.04,(.20,-.035,.60),yel),c(.06,.04,(.36,-.035,.60),pink),b((.56,.13,.04),(0,.78,.48),cream),b((.45,.16,.04),(0,-.55,.35),dark)]
 models['lamp']=[c(.37,.10,(0,-.75,0),metal),c(.045,1.17,(0,-.12,0),metal),cone(.47,.48,(0,.52,0),yel),e((.13,.13,.13),(0,.43,0),cream)]
 models['scooter']=[b((1.15,.12,.34),(-.10,-.16,0),cyan),b((.12,.67,.11),(.47,.19,0),metal),b((.11,.10,.65),(.47,.56,0),pink),b((.42,.20,.32),(-.43,.07,0),pink),b((.12,.27,.12),(-.43,-.04,0),metal)]+[c(.24,.16,(x,-.35,0),black,'z') for x in (-.59,.60)]+[c(.11,.18,(x,-.35,0),metal,'z') for x in (-.59,.60)]
 models['plane']=[e((.98,.24,.24),(0,0,0),cyan),b((.58,.09,1.76),(-.03,-.03,0),pink),b((.29,.065,.75),(-.70,.04,0),pink),b((.24,.43,.07),(-.74,.23,0),pink),e((.36,.15,.20),(.27,.19,0),glass),c(.06,.18,(.98,0,0),metal,'x'),b((.05,.77,.07),(1.10,0,0),cream)]
 models['submarine']=[e((1.0,.35,.36),(0,0,0),yel),b((.45,.32,.34),(-.04,.36,0),orange),b((.08,.35,.08),(.04,.65,0),metal),b((.22,.08,.08),(.12,.79,0),metal),b((.29,.07,.78),(-.85,0,0),orange),b((.30,.62,.065),(-.85,0,0),orange)]+[c(.12,.06,(x,.04,z),glass,'z') for x in (-.38,.02,.42) for z in (-.33,.33)]
 models['teapot']=[e((.54,.41,.44),(0,-.04,0),pink),c(.30,.10,(0,.35,0),cream),e((.09,.10,.09),(0,.45,0),metal)]+[e((.15,.16,.14),(.43+i*.13,.02+i*.09,0),pink) for i in range(4)]+[e((.08,.10,.09),(-.49-.28*math.sin(i*math.pi/6),.26*math.cos(i*math.pi/6),0),pink) for i in range(7)]
 models['umbrella']=[cone(.82,.43,(0,.49,0),red),c(.035,1.22,(0,-.16,0),metal)]+[e((.055,.07,.055),(.13+.13*math.cos(i*math.pi/6),-.77-.13*math.sin(i*math.pi/6),0),yel) for i in range(7)]
 models['cart']=[b((1.14,.075,.66),(0,-.28,0),metal),b((1.11,.065,.60),(0,.24,0),metal),b((.07,.07,.77),(-.60,.28,0),pink)]+[b((.045,.57,.045),(x,-.015,z),metal) for x in (-.53,-.27,0,.27,.53) for z in (-.32,.32)]+[b((1.15,.045,.045),(0,y,z),metal) for y in (-.22,0,.26) for z in (-.32,.32)]+[c(.14,.10,(x,-.44,z),black,'z') for x in (-.42,.42) for z in (-.27,.27)]
 models['guitar']=[e((.41,.46,.12),(0,-.39,0),orange),e((.31,.29,.11),(0,.08,0),orange),c(.12,.025,(0,.025,.13),dark,'z'),b((.12,.86,.075),(0,.63,0),dark),b((.22,.28,.075),(0,1.12,0),orange),b((.26,.06,.055),(0,-.46,.14),metal)]+[b((.008,1.46,.013),(x,.31,.15),cream) for x in (-.045,-.015,.015,.045)]
 models['armchair']=[b((1.12,.29,.92),(0,-.16,0),lil),b((1.13,.81,.23),(0,.34,-.37),lil),e((.20,.24,.52),(-.54,.09,.02),pink),e((.20,.24,.52),(.54,.09,.02),pink),b((.89,.16,.72),(0,.015,.04),cream)]+[b((.11,.25,.11),(x,-.39,z),dark) for x in (-.43,.43) for z in (-.32,.32)]
 models['train']=[b((1.56,.18,.66),(0,-.21,0),metal),c(.31,.96,(.23,.19,0),red,'x'),b((.55,.76,.61),(-.51,.17,0),pink),b((.65,.10,.71),(-.51,.59,0),dark),c(.11,.34,(.48,.55,0),dark),c(.16,.08,(.48,.76,0),metal),c(.12,.08,(.73,.19,0),cream,'x')]+[c(.21,.12,(x,-.32,z),black,'z') for x in (-.56,0,.56) for z in (-.35,.35)]+[b((.33,.31,.04),(-.52,.29,z),glass) for z in (-.32,.32)]
 # Replace color-only siblings in cast A with genuinely different geometry.
 models['book2']=[b((.78,.075,1.14),(-.40,0,0),yel),b((.78,.075,1.14),(.40,0,0),yel),b((.72,.09,1.06),(-.39,.08,0),cream),b((.72,.09,1.06),(.39,.08,0),cream)]+[b((.58,.008,.018),(x,.132,z),metal) for x in (-.39,.39) for z in (-.34,-.20,-.06,.08,.22,.36)]
 models['car2']=[b((1.77,.41,.93),(0,0,0),pink),b((1.56,.58,.88),(-.07,.47,0),pink),b((.56,.31,.93),(.48,.42,0),glass),b((.03,.29,.72),(.72,.45,0),glass),b((1.65,.075,.96),(-.07,.79,0),cream)]+[c(.24,.18,(x,-.20,z),black,'z') for x in (-.56,.56) for z in (-.46,.46)]
 models['cat2']=[e((.70,.32,.35),(0,0,0),orange),e((.33,.34,.32),(.58,.20,.03),orange)]+[cone(.15,.28,(.61,.43,z),orange) for z in (-.17,.17)]+[e((.20,.10,.12),(.31,-.25,z),orange) for z in (-.20,.20)]+[e((.09,.10,.12),(-.68-i*.12,.03+i*.06,.05),orange) for i in range(5)]+[e((.035,.065,.06),(.84,.22,z),yel) for z in (-.17,.17)]
 return models
