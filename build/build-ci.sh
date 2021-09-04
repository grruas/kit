WD=$(cd "$(dirname ${BASH_SOURCE[0]})"/.. &> /dev/null && pwd)
KIT="$WD/dist"

cd $WD
echo $WD

rm -r $KIT 2> /dev/null
mkdir -p $KIT
npx tsc --outDir $KIT
cp -a root/. $KIT
cp *.md *.json LICENSE $KIT

./build/install-node.sh --prefix $KIT/node

cd $KIT
PATH=./node/bin npm i