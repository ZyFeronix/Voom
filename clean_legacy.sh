#!/bin/bash
# clean_legacy.sh

echo "Iniciando limpieza de la deuda técnica de PHP..."

rm -rf public/api/
rm -f seed.php
rm -f test_*.php
rm -f public/cron.php
rm -f public/debug.php
rm -f public/install.php
rm -f public/router.php

echo "Limpieza completada exitosamente. PHP ha sido erradicado."
