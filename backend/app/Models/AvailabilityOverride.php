<?php
// app/Models/AvailabilityOverride.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AvailabilityOverride extends Model
{
    protected $table = 'availability_overrides';
    protected $primaryKey = 'date';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['date','open'];
}
